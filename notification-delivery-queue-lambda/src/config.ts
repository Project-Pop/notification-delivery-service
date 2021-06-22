import AWS from "aws-sdk";
const region = "ap-south-1";

AWS.config.update({
  region: region,
});

const dynamoClient = new AWS.DynamoDB.DocumentClient();
const snsClient = new AWS.SNS();

// TODO: enter details below
const rdsUsername = "[Your RDS User name]";
const hostName = "[insert your RDS Proxy endpoint here]";
const dbName = "[insert your RDS instance name]";

// TODO: enter details below
const notificationTableName = "[insert table name]";
const taggedTableName = "[insert table name]";

const signer = new AWS.RDS.Signer({
  region: region,
  hostname: hostName,
  port: 3306,
  username: rdsUsername,
});

const GeneralPopTable = "GeneralPopTable";

interface GeneralPopTableKeySchema {
  PK: string;
  SK: string;
}

function generateKeyForSNSAttributesFromTable(username: string) {
  // TODO: generate correct key
  return <GeneralPopTableKeySchema>{
    PK: `USER#${username}`,
    SK: "SNS_DATA#",
  };
}

enum NotificationType {
  Follow = "Follow",
  TagRequest = "TagRequest",
  TagResponse = "TagResponse",
  PostReaction = "PostReaction",
  Comment = "Comment",
  CommentReaction = "CommentReaction",
}

enum NotificationTargetType {
  User = "User",
  Post = "Post",
}

interface NotificationItem {
  username: string;
  notificationId: string;
  notificationType: NotificationType;
  timestamp: any;
  title: string;
  primaryMediaUrl: string;
  secondaryMediaUrl: string;
  targetType: NotificationTargetType;
  targetResourceId: string;
  opened: boolean;
  expiryTime: any;
}

interface TaggedUser {
  username: string;
}

export {
  hostName,
  rdsUsername,
  dbName,
  signer,
  notificationTableName,
  taggedTableName,
  dynamoClient,
  snsClient,
  GeneralPopTable,
  generateKeyForSNSAttributesFromTable,
  NotificationItem,
  NotificationType,
  TaggedUser,
};
