export {
  createNotification,
  listNotifications,
  markAsRead,
  dismissNotifications,
  getUnreadCount,
} from "./service";

export type {
  NotificationType,
  NotificationMetadata,
  NotificationRecord,
  NotificationListOptions,
  NotificationListResponse,
} from "./types";

export { NOTIFICATION_TYPES } from "./types";
