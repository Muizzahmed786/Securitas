class ApiResponse:
    def __init__(self, status_code, data, message="Success"):
        self.statusCode = status_code
        self.data = data
        self.message = message
        self.success = status_code < 400
        if isinstance(data, dict):
            for k, v in data.items():
                if not hasattr(self, k):
                    setattr(self, k, v)