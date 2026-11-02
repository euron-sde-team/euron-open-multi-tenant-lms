
class HealthService {
  async getHealth() {
    return {
      status: "running",
      timestamp: new Date().toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }

  async getRootRouteMsg() {
    return {
      message: "Hello from the admin-api server",
    };
  }
}

export default new HealthService();