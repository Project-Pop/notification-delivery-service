import {
  dbName,
  hostName,
  NotificationItem,
  NotificationType,
  rdsUsername,
  signer,
  TaggedUser,
} from "./config";

import mysql, { ConnectionOptions } from "mysql2/promise";
import { NotificationHandler } from "./notificationHandler";

exports.lambdaHandler = async (event: any, context: any) => {
  // TODO: add permission to lambda for using rds proxy
  const connectionConfig: ConnectionOptions = {
    host: hostName,
    user: rdsUsername,
    database: dbName,

    ssl: "Amazon RDS",
    authPlugins: {
      mysql_clear_password: () => () =>
        new Promise((resolve, reject) => {
          signer.getAuthToken({}, (err, token) => {
            if (err) reject("can not authorize");
            resolve(token);
          });
        }),
    },
  };

  const connection = await mysql.createConnection(connectionConfig);

  await connection.connect();

  const promises: Promise<any>[] = [];

  for (var msg of event.Records) {
    console.log(msg.messageAttributes);

    try {
      const notification: NotificationItem = JSON.parse(
        msg.messageAttributes.notification.stringValue
      );

      const notificationHandler = new NotificationHandler(
        connection,
        notification
      );

      if (
        notification.notificationType === NotificationType.Follow ||
        notification.notificationType === NotificationType.CommentReaction ||
        notification.notificationType === NotificationType.TagResponse
      ) {
        // all the attributes are present in notification.
        // username is taken from notification.

        promises.push(notificationHandler.handleSingularNotification());
      } else if (
        notification.notificationType === NotificationType.Comment ||
        notification.notificationType === NotificationType.PostReaction
      ) {
        const postId: string = msg.messageAttributes.postId.stringValue;
        const owner: string = msg.messageAttributes.owner.stringValue;
        promises.push(
          notificationHandler.notificationToTagApprovedUsers(postId, owner)
        );
        //
      } else if (
        notification.notificationType === NotificationType.TagRequest
      ) {
        const taggedUsers: TaggedUser[] = JSON.parse(
          msg.messageAttributes.taggedUsers.stringValue
        );
        promises.push(notificationHandler.tagRequestNotification(taggedUsers));
      }
    } catch (error) {
      console.log("error: ", error);
    }
  }

  await Promise.all(promises);

  // closing the connection.
  await connection.end();
};
