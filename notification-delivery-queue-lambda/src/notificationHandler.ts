import {
  dynamoClient,
  GeneralPopTable,
  generateKeyForSNSAttributesFromTable,
  NotificationItem,
  notificationTableName,
  snsClient,
  taggedTableName,
  TaggedUser,
} from "./config";

import mysql from "mysql2/promise";

export class NotificationHandler {
  private readonly _connection: mysql.Connection;
  private notification: NotificationItem;
  private insertQuery = `INSERT INTO ${notificationTableName} SET ?`;

  constructor(connection: mysql.Connection, notification: NotificationItem) {
    this._connection = connection;
    this.notification = notification;
  }

  private async sendSNSNotification(
    username: string,
    title: string,
    image: string
  ) {
    const snsAttributes = (
      await dynamoClient
        .get({
          TableName: GeneralPopTable,
          Key: generateKeyForSNSAttributesFromTable(username),
          AttributesToGet: ["endpointArn", "enabled"],
        })
        .promise()
    ).Item;
    // if this endpoint is enabled(active) then sending push notification on it.
    if (snsAttributes?.enabled && snsAttributes?.endpointArn) {
      const snsPushNotificationObj = {
        GCM: JSON.stringify({
          notification: {
            title: title,
            image: image,
            sound: "default",
            color: "#fff74040",
            click_action: "FLUTTER_NOTIFICATION_CLICK",
            icon: "ic_notification",
          },

          priority: "HIGH",
        }),
      };

      try {
        await snsClient
          .publish({
            Message: JSON.stringify(snsPushNotificationObj),
            MessageStructure: "json",
            TargetArn: snsAttributes.endpointArn,
          })
          .promise();
      } catch (error) {}
    }
  }

  private async deliverNotifications(notificationList: NotificationItem[]) {
    await this._connection.query(this.insertQuery, notificationList);

    const snsPromises = notificationList.map((notif) =>
      this.sendSNSNotification(
        notif.username,
        notif.title,
        notif.primaryMediaUrl
      )
    );
    await Promise.all(snsPromises);
  }

  private async fetchTagApprovedUsers(postId: string): Promise<any> {
    const fetchQuery = `SELECT username FROM ${taggedTableName} where postId = ?`;
    const data = await this._connection.query(fetchQuery, postId);
    // TODO: do necessary mappings here
    return data;
  }

  public async notificationToTagApprovedUsers(postId: string, owner: string) {
    const notificationList: NotificationItem[] = [];

    // fetching tag approved users and building notification for them.
    const taggedUsernames: string[] = await this.fetchTagApprovedUsers(postId);
    const taggedNotifications = taggedUsernames.map((username) => {
      const taggedUserNotification = Object.assign({}, this.notification);
      taggedUserNotification.username = username;
      return taggedUserNotification;
    });

    // building notification object for owner
    const ownerNotification = Object.assign({}, this.notification);
    ownerNotification.username = owner;

    notificationList.push(...taggedNotifications);
    notificationList.push(ownerNotification);

    await this.deliverNotifications(notificationList);
  }

  public async tagRequestNotification(taggedUsers: TaggedUser[]) {
    const notificationList = taggedUsers.map((tagged) => {
      const newNotification = Object.assign({}, this.notification);
      newNotification.username = tagged.username;
      return newNotification;
    });

    await this.deliverNotifications(notificationList);
  }

  public async handleSingularNotification() {
    await this.deliverNotifications([this.notification]);
  }
}
