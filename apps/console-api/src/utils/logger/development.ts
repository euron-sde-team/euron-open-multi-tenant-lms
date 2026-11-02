import winston, { format } from "winston";
import config from "../../config";
const { combine, timestamp, printf } = format;

const myFormat = printf(({ level, message, timestamp }) => {
  return `${level} ${timestamp} : ${message}`;
});

const developmentLogger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: combine(
    format.colorize(),
    timestamp({ format: "HH:mm:ss" }),
    myFormat
  ),
  transports: [
    new winston.transports.Console(),
    ...(config.LOG_FILE ? [new winston.transports.File({ filename: config.LOG_FILE })] : []),
  ],
});

export default developmentLogger;