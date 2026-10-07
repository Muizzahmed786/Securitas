from app.utils.ApiError import ApiError
from app.utils.ApiResponse import ApiResponse

async def read_body(request):
    try:
        body = await request.json()
    except ValueError:
        raise ApiError(400, "Request body must be valid JSON")
    if not isinstance(body, dict):
        raise ApiError(400, "Request body must be a JSON object")
    return body


def required_string(body, field):
    value = body.get(field)
    if not isinstance(value, str) or value.strip() == "":
        raise ApiError(400, field + " is required")
    return value