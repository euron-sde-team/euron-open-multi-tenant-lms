import winston, { format } from "winston";
const { combine, timestamp, printf } = format;

const myFormat = printf(({ level, message, timestamp }) => {
  return `${level} ${timestamp} : ${message}`;
});

// Console only by default: on ECS the app directory is read-only and stdout is
// what reaches the log group. LOG_FILE adds a file transport (errors only).
const transports: winston.transport[] = [new winston.transports.Console()];
if (process.env.LOG_FILE) {
  transports.push(new winston.transports.File({ filename: process.env.LOG_FILE, level: "error" }));
}

const developmentLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || "debug",
  format: combine(
    format.colorize(),
    timestamp({ format: "HH:mm:ss" }),
    myFormat
  ),
  transports,
});

export default developmentLogger;
