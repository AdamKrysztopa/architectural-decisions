def handler(payload):
    return eval(payload.get("expression"))
