# SecureStore

> **Serverless File Sharing & Collaboration Platform on AWS**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Visit%20App-teal?style=for-the-badge)](https://main.d2x7us01sw6mdx.amplifyapp.com)
![Version](https://img.shields.io/badge/Version-1.0-navy?style=for-the-badge)
![AWS](https://img.shields.io/badge/Built%20on-AWS-orange?style=for-the-badge&logo=amazonaws)

SecureStore is a fully serverless file sharing and collaboration platform built on Amazon Web Services (AWS). It allows authenticated users to upload, download, share, and comment on files. All data is encrypted at rest and all access is controlled via Cognito-issued JWT tokens. The platform is designed to be cost-efficient, scalable, and secure — leveraging AWS free tier services where possible, with costs scaling only as usage grows.

---

## Features

- 🔐 Secure file upload and download with KMS encryption
- 👤 Per-user file ownership and access control
- 📤 File sharing with other registered users by email
- 💬 Collaborative commenting on files (owner and shared users)
- 🔗 24-hour shareable download links
- 🔑 Cognito-based authentication with forgot password flow
- ⚛️ Responsive React frontend deployed on AWS Amplify

---

## Architecture

SecureStore uses a six-layer serverless architecture. Each layer is a managed AWS service — no servers to provision or maintain.

| Layer | Service | Purpose | Technology |
|-------|---------|---------|------------|
| 1 | AWS Amplify + CloudFront | Frontend hosting & CDN delivery | React, Amplify SDK |
| 2 | Amazon Cognito | User authentication & identity | JWT tokens, user pools |
| 3 | AWS AppSync | GraphQL API gateway | GraphQL, JS resolvers |
| 4 | AWS Lambda | Business logic & access control | Python 3.12 |
| 5a | Amazon DynamoDB | File metadata, shares, comments | NoSQL, single-table design |
| 5b | Amazon S3 | File storage | KMS encryption, presigned URLs |

### Request Flow

The following describes the end-to-end flow for a typical user action (e.g. downloading a file):

1. User clicks **Download** in the React app
2. React calls AppSync via GraphQL (`getDownloadUrl` mutation)
3. AppSync verifies the Cognito JWT token — rejects if invalid
4. AppSync resolver packages the request and invokes Lambda
5. Lambda checks DynamoDB for `FILE#` ownership record
6. Lambda calls S3 to generate a SigV4 presigned URL (valid 1 hour)
7. URL is returned through AppSync back to the React app
8. Browser downloads the file directly from S3 — Lambda is not involved in the transfer

---

## AWS Resources

<details>
<summary><strong>Amplify</strong></summary>

| Property | Value |
|----------|-------|
| App name | SecureStore |
| Domain | https://main.d2x7us01sw6mdx.amplifyapp.com |
| Repository | SecureStore:main (GitHub) |
| Deploy trigger | git push to main branch |

</details>

<details>
<summary><strong>Cognito</strong></summary>

| Property | Value |
|----------|-------|
| User pool ID | us-east-1_dB7LLqLBD |
| Client ID | 5t7s598es2q8e0lipftv356gij |
| Region | us-east-1 |
| Auth flow | Email + password, forgot password email code |

</details>

<details>
<summary><strong>AppSync</strong></summary>

| Property | Value |
|----------|-------|
| API name | my-app-api |
| Endpoint | https://n7sry4lnivbf3kh5wu37a27nbi.appsync-api.us-east-1.amazonaws.com/graphql |
| Auth mode | Cognito User Pool (JWT) |
| Resolver type | JavaScript (AppSync JS) |

</details>

<details>
<summary><strong>Lambda</strong></summary>

| Property | Value |
|----------|-------|
| Function name | my-app-handler |
| Runtime | Python 3.12 |
| IAM role | my-app-lambda-role |
| Memory | 128 MB |
| Timeout | Default (3s) |

</details>

<details>
<summary><strong>DynamoDB</strong></summary>

| Property | Value |
|----------|-------|
| Table name | secure_store_table |
| Partition key | secureID (String) |
| Sort key | SecureSort (String) |
| GSI | sharedWithEmail-index (partition: sharedWithEmail) |
| Region | us-east-1 |

</details>

<details>
<summary><strong>S3</strong></summary>

| Property | Value |
|----------|-------|
| Bucket name | my-app-uploads-117820556332 |
| Encryption | SSE-KMS (AWS managed key) |
| Access | Private — all public access blocked |
| File path pattern | `uploads/<owner_id>/<file_id>/<filename>` |
| Signature version | SigV4 (required for KMS) |

</details>

---

## Data Model

SecureStore uses a single-table DynamoDB design. All record types share the same table (`secure_store_table`) and are distinguished by their `SecureSort` key prefix.

### Record Types

| Record Type | Sort Key Pattern | Fields Stored |
|-------------|-----------------|---------------|
| File | `FILE#<uuid>` | ownerID, fileName, uploadedAt, status, s3Key |
| Share | `SHARE#<email>` | sharedWithEmail, sharedBy, fileName, s3Key, sharedAt, itemType |
| Comment | `COMMENT#<uuid>` | commentId, comment, authorID, createdAt, itemType |

### Access Patterns

| Operation | DynamoDB Operation | Index Used |
|-----------|-------------------|------------|
| Get a specific file | GetItem | Primary key |
| List files for a user | Scan + filter | None (ownerID + FILE# filter) |
| Get shared files by email | Query | sharedWithEmail-index |
| Get comments for a file | Query + begins_with | Primary key (COMMENT# prefix) |
| Check share access | Query + begins_with | Primary key (SHARE# prefix) |

---

## API Reference

All operations are exposed via GraphQL through AWS AppSync. Every request must include a valid Cognito JWT token.

**Endpoint:** `https://n7sry4lnivbf3kh5wu37a27nbi.appsync-api.us-east-1.amazonaws.com/graphql`

### Queries

| Query | Arguments | Returns | Description |
|-------|-----------|---------|-------------|
| `listFiles` | none | `[File]` | All files owned by caller |
| `getFile` | `id: ID!` | `File` | Single file by ID (owner only) |
| `getSharedFiles` | `email: String!` | `[SharedFile]` | Files shared with given email |
| `getComments` | `fileId: ID!` | `[Comment]` | Comments on a file (owner or shared user) |
| `getDownloadUrl` | `fileId: ID!` | `DownloadUrl` | Presigned S3 URL (1 hour) |

### Mutations

| Mutation | Arguments | Returns | Description |
|----------|-----------|---------|-------------|
| `uploadFile` | fileName, fileData, fileType | `File` | Upload base64 file |
| `deleteFile` | `id: ID!` | `File` | Delete file (owner only) |
| `shareFile` | fileId, email | `ShareResult` | Share file with a user |
| `addComment` | fileId, comment | `Comment` | Add comment (owner or shared user) |
| `generateShareLink` | `fileId: ID!` | `ShareLink` | 24-hour presigned URL |
| `getPresignedUrl` | `fileName: String!` | `PresignedUrl` | PUT URL for direct S3 upload |

---

## Security Model

### Authentication
All API requests must include a valid Cognito JWT token. AppSync validates the token on every request before invoking any resolver. Unauthenticated requests are rejected at the API gateway level.

### Access Control
The Lambda function enforces access control on every operation:
- **FILE# records** — only the owner (matched by Cognito sub) can read, download, share, or delete
- **SHARE# records** — users with a matching `SHARE#` record can download and comment on shared files
- **COMMENT# records** — only the file owner or users with a `SHARE#` record can read or write comments
- All other requests return an `Unauthorized` exception

### Encryption
- **At rest** — SSE-KMS encryption on all S3 objects
- **In transit** — HTTPS enforced by Amplify/CloudFront on all requests
- **Presigned URLs** — AWS Signature Version 4 (required for KMS-encrypted buckets)
- **Passwords** — managed entirely by Cognito; never stored in the application

### IAM Permissions

**DynamoDB** (`my-app-lambda-role`):
- `GetItem`, `PutItem`, `UpdateItem`, `DeleteItem`, `Query`, `Scan` on `secure_store_table`
- `Query` on `secure_store_table/index/sharedWithEmail-index` (GSI)

**S3:**
- `GetObject`, `PutObject` on `my-app-uploads-117820556332/*`

---

## Cost Model

SecureStore is designed to run at near-zero cost at low traffic levels, with costs scaling proportionally as usage grows.

| Service | Free Tier | Est. Monthly | Cost Driver |
|---------|-----------|-------------|-------------|
| AWS Amplify | 1000 build mins | ~$2.00 | Hosting + build minutes |
| AWS KMS | None | $1.00 | $1/month per key (flat fee) |
| AWS AppSync | 250M queries/month | ~$0.00 | Well within free tier |
| AWS Lambda | 1M requests/month | ~$0.00 | Well within free tier |
| Amazon DynamoDB | 25GB + 200M reqs | ~$0.00 | Well within free tier |
| Amazon S3 | 5GB + 20K reqs | ~$0.00 | Scales with file storage |
| Amazon Cognito | 50K MAUs | ~$0.00 | Free up to 50K MAUs |
| **Total (estimated)** | | **~$3.00/mo** | At low/dev traffic |

---

## Deployment

### Prerequisites
- AWS account with appropriate permissions
- Node.js 18+ and npm installed
- Git installed and configured
- AWS CLI installed (optional, for manual Lambda deploys)

### Frontend Deployment

The frontend deploys automatically via Amplify on every push to `main`:

```bash
git add .
git commit -m "your message"
git push
```

Amplify detects the push and triggers a new build automatically. Build typically completes in 2–3 minutes.

### Lambda Deployment

**Via AWS Console:**
1. Navigate to **AWS Lambda > Functions > my-app-handler**
2. Edit the code directly in the browser editor
3. Click **Deploy** (`Ctrl+Shift+U`) to save and publish changes

**Via CLI:**
```bash
zip -r function.zip lambda_function.py
aws lambda update-function-code \
  --function-name my-app-handler \
  --zip-file fileb://function.zip
```

### Environment Variables

| Variable | Value |
|----------|-------|
| `TABLE_NAME` | secure_store_table |
| `BUCKET_NAME` | my-app-uploads-117820556332 |

---

## Changelog

| # | Issue | Fix Applied |
|---|-------|-------------|
| 1 | Unknown field: `getdownloadUrl` | AppSync resolver field name corrected to `getDownloadUrl` |
| 2 | AccessDeniedException on Shared With Me | Added GSI ARN to Lambda IAM DynamoDB policy |
| 3 | InvalidArgument — KMS SigV2 error | Added `Config(signature_version='s3v4')` to S3 client |
| 4 | Shared users could not download files | `get_download_url` now checks `SHARE#` records as fallback |
| 5 | No access control on comments | Added `has_file_access` helper; only owners and shared users can comment |
| 6 | `get_comments` boto3 expression error | Fixed to use boto3 `Key()` condition instead of raw string |
| 7 | `list_files` returning wrong item types | Added `Attr` filter to only return `FILE#` records |
| 8 | `get_comments` not receiving `owner_id` | Updated `lambda_handler` routing to pass `owner_id` |
| 9 | Shared users had no comment UI | Added Comments button and input to Shared With Me tab in App.js |
| 10 | No delete confirmation | Added `window.confirm` dialog before `handleDelete` |
| 11 | No forgot password flow | Added `resetPassword` and `confirmResetPassword` Cognito flow |
| 12 | Generic default styling | Restyled app with navy/teal theme matching SecureStore logo |
| 13 | Alert messages lingered indefinitely | Added `useEffect` to auto-dismiss success/error after 3 seconds |

---

*SecureStore — v1.0 · April 2026 · Built on AWS — Serverless, Secure, Scalable*
