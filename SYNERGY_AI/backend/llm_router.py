import os
import time
import requests
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

# Preferred priority order — primary model is always tried first
_DEFAULT_POOL = [
    'gemini-3.5-flash',
    'gemini-flash-lite-latest',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-flash-latest',
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-pro-latest',
]


def _get_model_pool():
    raw = os.getenv('GEMINI_MODEL_POOL', '')
    if raw.strip():
        pool = [m.strip().split('/')[-1] for m in raw.split(',') if m.strip()]
        seen = set(pool)
        for m in _DEFAULT_POOL:
            if m not in seen:
                pool.append(m)
        return pool
    return list(_DEFAULT_POOL)


_EXHAUSTED_MODELS = {}
COOLDOWN_SECONDS = int(os.getenv('GEMINI_COOLDOWN_SECONDS', '60'))


def _is_exhausted(model):
    """
    Checks if a model was marked rate-limited.
    Once COOLDOWN_SECONDS have passed (e.g., rate limit period reset),
    the model is automatically un-blacklisted and will be used first again.
    """
    ts = _EXHAUSTED_MODELS.get(model)
    if ts is None:
        return False
    elapsed = time.time() - ts
    if elapsed > COOLDOWN_SECONDS:
        print('[LLMRouter] Cooldown expired (' + str(int(elapsed)) + 's) for ' + model + '. Returning to primary rotation!')
        del _EXHAUSTED_MODELS[model]
        return False
    return True


def _mark_exhausted(model):
    _EXHAUSTED_MODELS[model] = time.time()
    print('[LLMRouter] Model ' + model + ' hit rate limit. Temporarily switching to next model for ' + str(COOLDOWN_SECONDS) + 's.')


def call_gemini(
    prompt_text,
    api_key=None,
    temperature=0.85,
    max_tokens=4096,
    timeout=90,
    inter_model_delay=2.0,
):
    key = api_key or os.getenv('GEMINI_API_KEY', '')
    if not key:
        raise ValueError(
            'GEMINI_API_KEY is not configured in backend/.env. '
            'Please add a valid Gemini API key from https://aistudio.google.com.'
        )

    pool = _get_model_pool()
    # Check models in order; models whose cooldown expired are automatically back in rotation
    available = [m for m in pool if not _is_exhausted(m)]

    if not available:
        print('[LLMRouter] All Gemini models currently in cooldown. Waiting ' + str(COOLDOWN_SECONDS) + 's for quota reset...')
        time.sleep(COOLDOWN_SECONDS)
        _EXHAUSTED_MODELS.clear()
        available = list(pool)

    all_exhausted = True
    last_error = None

    for idx, model_name in enumerate(available):
        if idx > 0:
            print('[LLMRouter] Waiting ' + str(inter_model_delay) + 's before trying ' + model_name + '...')
            time.sleep(inter_model_delay)

        url = (
            'https://generativelanguage.googleapis.com/v1beta/models/'
            + model_name + ':generateContent?key=' + key
        )
        payload = {
            'contents': [{'parts': [{'text': prompt_text}]}],
            'generationConfig': {
                'temperature': temperature,
                'maxOutputTokens': max_tokens,
                'topP': 0.95,
            },
        }

        try:
            response = requests.post(
                url,
                headers={'Content-Type': 'application/json'},
                json=payload,
                timeout=timeout,
            )

            if response.status_code == 200:
                data = response.json()
                candidates = data.get('candidates', [])
                if candidates and 'content' in candidates[0]:
                    parts = candidates[0]['content'].get('parts', [])
                    if parts and 'text' in parts[0]:
                        text = parts[0]['text'].strip()
                        if text:
                            print('[LLMRouter] Success from ' + model_name + '.')
                            return text
                print('[LLMRouter] ' + model_name + ' returned 200 but empty content. Trying next model...')
                all_exhausted = False

            elif response.status_code == 429:
                _mark_exhausted(model_name)

            elif response.status_code == 503:
                print('[LLMRouter] ' + model_name + ' -> 503 (high demand spike). Trying next model...')
                all_exhausted = False

            elif response.status_code in (400, 403, 404):
                print('[LLMRouter] ' + model_name + ' -> HTTP ' + str(response.status_code) + ' (unavailable). Skipping.')
                all_exhausted = False

            else:
                print('[LLMRouter] ' + model_name + ' -> HTTP ' + str(response.status_code) + '. Trying next model...')
                all_exhausted = False

        except Exception as exc:
            print('[LLMRouter] ' + model_name + ' error: ' + str(exc) + '. Trying next model...')
            all_exhausted = False
            last_error = exc

    if all_exhausted:
        raise ValueError(
            'All Gemini models in the pool hit rate limits (HTTP 429). '
            'Please wait 1 minute for your Gemini rate limit window to reset and try again.'
        )

    if last_error:
        raise last_error

    raise ValueError('No candidates returned from any Gemini model in the pool.')
