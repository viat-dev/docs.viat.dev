# @resource ha_settings
# @resource ha_api
from viat import ctx, ViatError


READABLE = frozenset({'sensor.example_temperature', 'light.example_desk'})


def main(entity: str = 'sensor.example_temperature'):
    cfg = ctx.resources.ha_settings
    principal = ctx.principal
    if (not principal.user_id or principal.authorizer not in cfg['http_authorizers']
            or principal.user_id not in cfg['read_user_ids']):
        raise ViatError(403, 'forbidden', 'Home read access denied')
    if not isinstance(entity, str) or entity not in READABLE:
        raise ViatError(400, 'bad_request', 'Entity is not readable')
    if cfg['read_mode'] == 'fixture':
        state = cfg['fixture_states'][entity]
    elif cfg['read_mode'] == 'http' and cfg['read_network_enabled'] is True:
        try:
            state = ctx.resources.ha_api.get('/api/states/' + entity, timeout=5)
        except Exception:
            # The HTTP helper may attach a private upstream body to ViatError.
            # Never forward that exception or its chained traceback to callers.
            raise ViatError(502, 'upstream_error', 'Home state unavailable') from None
    else:
        raise ViatError(403, 'forbidden', 'Home network reads disabled')
    if (not isinstance(state, dict) or state.get('entity_id') != entity
            or not isinstance(state.get('state'), str)):
        raise ViatError(502, 'upstream_error', 'Invalid Home state')
    # Do not expose arbitrary attributes, coordinates or upstream error bodies.
    return {'entity_id': entity, 'state': state['state'], 'fixture': cfg['read_mode'] == 'fixture'}
