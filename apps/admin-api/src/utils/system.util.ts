import ip from "ip";

export const getLocalIP = () => {
  try {
    return ip.address();
  } catch {
    return "127.0.0.1";
  }
};
