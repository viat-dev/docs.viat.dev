# @resource ha_settings
# @resource ha_api
from viat import ctx, ViatError


# A caller cannot expand this map through JSON, an LLM response or config data.
ACTIONS = {
    'light.turn_on': ('light', 'turn_on', frozenset({'brightness'})),
    'light.turn_off': ('light', 'turn_off', frozenset()),
}
ENTITIES = frozenset({'light.example_desk'})


def main(action: str, entity: str, data: dict = None, confirm: bool = False):
    cfg = ctx.resources.ha_settings
    principal = ctx.principal
    if (not principal.user_id or principal.authorizer not in cfg['http_authorizers']
            or principal.user_id not in cfg['execute_user_ids']):
        raise ViatError(403, 'forbidden', 'Home action access denied')
    if not isinstance(action, str) or action not in ACTIONS:
        raise ViatError(400, 'bad_request', 'Action is not allowed')
    if not isinstance(entity, str) or entity not in ENTITIES:
        raise ViatError(400, 'bad_request', 'Entity is not actionable')
    data = {} if data is None else data
    domain, service, fields = ACTIONS[action]
    if not isinstance(data, dict) or not set(data).issubset(fields):
        raise ViatError(400, 'bad_request', 'Unexpected service fields')
    if 'brightness' in data and (type(data['brightness']) is not int or not 1 <= data['brightness'] <= 255):
        raise ViatError(400, 'bad_request', 'Brightness must be an integer from 1 through 255')
    if cfg['real_actions_enabled'] is not True or confirm is not True:
        return {'executed': False, 'reason': 'actions_disabled_or_unconfirmed'}
    # No arbitrary paths, templates, targets, scripts, automations, locks or alarm services.
    try:
        response = ctx.resources.ha_api.post('/api/services/' + domain + '/' + service,
                                            json={'entity_id': entity, **data}, timeout=5)
    except Exception:
        # Sanitize upstream details without implying a timed-out action rolled back.
        raise ViatError(502, 'upstream_error',
                        'Home service unavailable; effect may have applied') from None
    if not isinstance(response, list):
        raise ViatError(502, 'upstream_error', 'Unexpected Home service response; effect may have applied')
    return {'executed': True, 'entity_id': entity, 'action': action,
            'note': 'HTTP accepted; independently verify the physical state'}
