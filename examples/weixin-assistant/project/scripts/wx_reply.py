# @resource wx_settings
from viat import ctx


REPLIES = {
    '/help': 'Commands: /help, /status. This assistant cannot control devices or send unsolicited messages.',
    '帮助': '可用命令：帮助、状态。此助手不能控制设备，也不会主动给他人发消息。',
    '/status': 'The private-chat command handler is available. This is not a device or provider health check.',
    '状态': '私聊命令处理器可用。这不是设备状态或供应商健康检查。',
}
UNKNOWN = 'Unsupported command / 不支持的命令。Use /help or 帮助。'


def main(message: dict = None):
    cfg = ctx.resources.wx_settings
    if not isinstance(message, dict):
        return None
    principal = ctx.principal
    account = message.get('account')
    identity = message.get('identity')
    if (message.get('platform') != 'weixin' or message.get('chat_type') != 'direct'
            or not isinstance(account, dict) or account.get('name') != cfg['account_name']
            or not principal.user_id or principal.authorizer != 'chat'
            or not isinstance(identity, dict) or identity.get('user_id') != principal.user_id
            or cfg['sender_users'].get(message.get('sender_id')) != principal.user_id):
        return None
    text = message.get('text')
    if message.get('kind') != 'text' or not isinstance(text, str) or len(text) > 256:
        return None
    if cfg['messages_enabled'] is not True:
        return None
    # Never echo provider raw payloads, user text, QR handles or reply permits.
    # Returning text lets the native dispatcher use the inbound conversation's permit.
    return REPLIES.get(text.strip(), UNKNOWN)
