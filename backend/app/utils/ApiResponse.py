class ApiResponse:
  def __init__(self, status_code, data, message="Success"):
    self.statusCode = status_code
    self.data = data
    self.message = message
    self.success = status_code < 400