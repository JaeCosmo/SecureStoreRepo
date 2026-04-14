import { Amplify } from 'aws-amplify';
import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';
import { signIn, signUp, signOut, confirmSignUp, getCurrentUser,
  resetPassword, confirmResetPassword } from 'aws-amplify/auth';
import './App.css';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: 'us-east-1_dB7LLqLBD',
      userPoolClientId: '5t7s598es2q8e0lipftv356gij',
      region: 'us-east-1'
    }
  },
  API: {
    GraphQL: {
      endpoint: 'https://n7sry4lnivbf3kh5wu37a27nbi.appsync-api.us-east-1.amazonaws.com/graphql',
      region: 'us-east-1',
      defaultAuthMode: 'userPool'
    }
  }
});

const client = generateClient();

const listFilesQuery = `
  query ListFiles {
    listFiles {
      secureID
      fileName
      uploadedAt
      status
      s3Key
    }
  }
`;

const uploadFileMutation = `
  mutation UploadFile($fileName: String!, $fileData: String!, $fileType: String!) {
    uploadFile(fileName: $fileName, fileData: $fileData, fileType: $fileType) {
      secureID
      fileName
      uploadedAt
      status
      s3Key
    }
  }
`;

const deleteFileMutation = `
  mutation DeleteFile($id: ID!) {
    deleteFile(id: $id) {
      secureID
      fileName
    }
  }
`;

const shareFileMutation = `
  mutation ShareFile($fileId: ID!, $email: String!) {
    shareFile(fileId: $fileId, email: $email) {
      fileId
      email
      fileName
      sharedAt
    }
  }
`;

const getSharedFilesQuery = `
  query GetSharedFiles($email: String!) {
    getSharedFiles(email: $email) {
      secureID
      fileName
      sharedBy
      sharedAt
      s3Key
    }
  }
`;

const addCommentMutation = `
  mutation AddComment($fileId: ID!, $comment: String!) {
    addComment(fileId: $fileId, comment: $comment) {
      commentId
      comment
      authorID
      createdAt
    }
  }
`;

const getCommentsQuery = `
  query GetComments($fileId: ID!) {
    getComments(fileId: $fileId) {
      commentId
      comment
      authorID
      createdAt
    }
  }
`;

const getDownloadUrlQuery = `
  query GetDownloadUrl($fileId: ID!) {
    getDownloadUrl(fileId: $fileId) {
      url
      fileName
    }
  }
`;

const generateShareLinkMutation = `
  mutation GenerateShareLink($fileId: ID!) {
    generateShareLink(fileId: $fileId) {
      url
      fileName
      expiresIn
    }
  }
`;

export default function App() {
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [shareEmail, setShareEmail] = useState('');
  const [sharingFileId, setSharingFileId] = useState(null);
  const [sharedFiles, setSharedFiles] = useState([]);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [shareLink, setShareLink] = useState('');
  const [activeTab, setActiveTab] = useState('myFiles');
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      loadFiles();
    } catch {
      setUser(null);
    }
  }

  async function loadFiles() {
    try {
      const result = await client.graphql({ query: listFilesQuery });
      setFiles(result.data.listFiles || []);
    } catch (err) {
      setError('Failed to load files');
    }
  }

  async function handleSignIn() {
    try {
      setError('');
      await signIn({ username: email, password });
      await checkUser();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSignUp() {
    try {
      setError('');
      await signUp({
        username: email,
        password,
        options: { userAttributes: { email } }
      });
      setNeedsConfirmation(true);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleConfirm() {
    try {
      setError('');
      await confirmSignUp({ username: email, confirmationCode: confirmCode });
      setSuccess('Account confirmed! Please sign in.');
      setNeedsConfirmation(false);
      setAuthMode('signin');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSignOut() {
    await signOut();
    setUser(null);
    setFiles([]);
  }

   async function handleForgotPassword() {
    try {
      setError('');
      await resetPassword({ username: email });
      setForgotPasswordMode('confirm');
      setSuccess('Reset code sent to your email!');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleConfirmResetPassword() {
    try {
      setError('');
      await confirmResetPassword({
        username: email,
        confirmationCode: resetCode,
        newPassword
      });
      setSuccess('Password reset! Please sign in.');
      setForgotPasswordMode(false);
      setAuthMode('signin');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      await client.graphql({
        query: uploadFileMutation,
        variables: {
          fileName: file.name,
          fileData: base64,
          fileType: file.type || 'application/octet-stream'
        }
      });
      setSuccess(`${file.name} uploaded successfully!`);
      loadFiles();
    } catch (err) {
      setError('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(fileId) {
    try {
      setError('');
      await client.graphql({
        query: deleteFileMutation,
        variables: { id: fileId }
      });
      setSuccess('File deleted successfully');
      loadFiles();
    } catch (err) {
      setError('Delete failed: ' + err.message);
    }
  }

  async function handleShare(fileId) {
    if (!shareEmail) return;
    try {
      setError('');
      await client.graphql({
        query: shareFileMutation,
        variables: { fileId, email: shareEmail }
      });
      setSuccess(`File shared with ${shareEmail} successfully!`);
      setShareEmail('');
      setSharingFileId(null);
    } catch (err) {
      setError('Share failed: ' + err.message);
    }
  }

  async function loadSharedFiles() {
  try {
    const currentUser = await getCurrentUser();
    const userEmail = currentUser.signInDetails?.loginId 
      || currentUser.username;
    
    const result = await client.graphql({
      query: getSharedFilesQuery,
      variables: { email: userEmail }
    });
    setSharedFiles(result.data.getSharedFiles || []);
  } catch (err) {
    setError('Failed to load shared files: ' + err.message);
  }
}

  async function handleLoadComments(fileId) {
    try {
      setSelectedFile(fileId);
      const result = await client.graphql({
        query: getCommentsQuery,
        variables: { fileId }
      });
      setComments(result.data.getComments || []);
    } catch (err) {
      setError('Failed to load comments');
    }
  }

  async function handleAddComment(fileId) {
    if (!commentText) return;
    try {
      await client.graphql({
        query: addCommentMutation,
        variables: { fileId, comment: commentText }
      });
      setCommentText('');
      handleLoadComments(fileId);
      setSuccess('Comment added!');
    } catch (err) {
      setError('Failed to add comment');
    }
  }

  async function handleDownload(fileId) {
    try {
      const result = await client.graphql({
        query: getDownloadUrlQuery,
        variables: { fileId }
      });
      const { url, fileName } = result.data.getDownloadUrl;
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
    } catch (err) {
      setError('Download failed: ' + err.message);
    }
  }

  async function handleGenerateShareLink(fileId) {
    try {
      const result = await client.graphql({
        query: generateShareLinkMutation,
        variables: { fileId }
      });
      setShareLink(result.data.generateShareLink.url);
      setSuccess('Share link generated! Valid for 24 hours.');
    } catch (err) {
      setError('Failed to generate share link: ' + err.message);
    }
  }

  const styles = {
    container: { maxWidth: '800px', margin: '0 auto', padding: '20px', fontFamily: 'Arial, sans-serif' },
    authBox: { maxWidth: '400px', margin: '100px auto', padding: '40px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', borderRadius: '8px' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
    title: { color: '#232f3e' },
    subtitle: { color: '#666', marginBottom: '20px' },
    input: { width: '100%', padding: '10px', marginBottom: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' },
    button: { width: '100%', padding: '10px', background: '#ff9900', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px' },
    signOutButton: { padding: '8px 16px', background: '#232f3e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' },
    deleteButton: { padding: '6px 12px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' },
    error: { background: '#fde8e8', color: '#c0392b', padding: '10px', borderRadius: '4px', marginBottom: '10px' },
    success: { background: '#e8f8e8', color: '#27ae60', padding: '10px', borderRadius: '4px', marginBottom: '10px' },
    uploadBox: { background: '#f9f9f9', padding: '20px', borderRadius: '8px', marginBottom: '20px' },
    filesBox: { background: '#f9f9f9', padding: '20px', borderRadius: '8px' },
    fileItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px', background: 'white', borderRadius: '4px', marginBottom: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
    fileDate: { color: '#666', fontSize: '12px', margin: '4px 0 0 0' },
    toggle: { textAlign: 'center', marginTop: '10px' },
    link: { color: '#ff9900', cursor: 'pointer', textDecoration: 'underline' },
    tabs: { display: 'flex', marginBottom: '20px', gap: '10px' },
    tab: { padding: '10px 20px', background: '#f0f0f0', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' },
    activeTab: { padding: '10px 20px', background: '#232f3e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' },
    fileActions: { display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' },
    actionButton: { padding: '6px 12px', background: '#ff9900', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' },
    shareRow: { display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' },
    shareInput: { flex: 1, padding: '6px', border: '1px solid #ddd', borderRadius: '4px' },
    shareButton: { padding: '6px 12px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' },
    cancelButton: { padding: '6px 12px', background: '#95a5a6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' },
    commentsBox: { marginTop: '10px', padding: '10px', background: '#f9f9f9', borderRadius: '4px' },
    comment: { padding: '6px 0', borderBottom: '1px solid #eee' },
    commentText: { margin: '0 0 4px 0' },
    commentDate: { margin: 0, fontSize: '11px', color: '#999' },
    shareLinkBox: { background: '#fff3cd', padding: '12px', borderRadius: '4px', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
    shareLinkInput: { flex: 1, padding: '6px', border: '1px solid #ddd', borderRadius: '4px', minWidth: '200px' },
    copyButton: { padding: '6px 12px', background: '#3498db', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' },
  };

  if (!user) {
    return (
      <div style={styles.container}>
        <div style={styles.authBox}>
          <h1 style={styles.title}>SecureStore</h1>
          <p style={styles.subtitle}>Secure file storage platform</p>
          {error && <div style={styles.error}>{error}</div>}
          {success && <div style={styles.success}>{success}</div>}
          {needsConfirmation ? (
            <>
              <p>Enter the confirmation code sent to {email}</p>
              <input style={styles.input} placeholder="Confirmation code"
                value={confirmCode} onChange={e => setConfirmCode(e.target.value)} />
              <button style={styles.button} onClick={handleConfirm}>Confirm Account</button>
            </>
          ) : (
            <>
              <input style={styles.input} placeholder="Email"
                value={email} onChange={e => setEmail(e.target.value)} />
              <input style={styles.input} placeholder="Password" type="password"
                value={password} onChange={e => setPassword(e.target.value)} />
             {authMode === 'signin' ? (
  <>
    {!forgotPasswordMode ? (
      <>
        <button style={styles.button} onClick={handleSignIn}>Sign In</button>
        <p style={styles.toggle}>
          <span style={styles.link} onClick={() => setForgotPasswordMode('request')}>
            Forgot password?
          </span>
        </p>
      </>
    ) : forgotPasswordMode === 'request' ? (
      <>
        <button style={styles.button} onClick={handleForgotPassword}>
          Send Reset Code
        </button>
        <p style={styles.toggle}>
          <span style={styles.link} onClick={() => setForgotPasswordMode(false)}>
            Back to sign in
          </span>
        </p>
      </>
    ) : (
      <>
        <input style={styles.input} placeholder="Reset code"
          value={resetCode} onChange={e => setResetCode(e.target.value)} />
        <input style={styles.input} placeholder="New password" type="password"
          value={newPassword} onChange={e => setNewPassword(e.target.value)} />
        <button style={styles.button} onClick={handleConfirmResetPassword}>
          Reset Password
        </button>
        <p style={styles.toggle}>
          <span style={styles.link} onClick={() => setForgotPasswordMode(false)}>
            Back to sign in
          </span>
        </p>
      </>
    )}
    <p style={styles.toggle}>
      Don't have an account?{' '}
      <span style={styles.link} onClick={() => setAuthMode('signup')}>Sign Up</span>
    </p>
  </>
) : (
  <>
    <button style={styles.button} onClick={handleSignUp}>Sign Up</button>
    <p style={styles.toggle}>
      Already have an account?{' '}
      <span style={styles.link} onClick={() => setAuthMode('signin')}>Sign In</span>
    </p>
  </>
)}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>SecureStore</h1>
        <button style={styles.signOutButton} onClick={handleSignOut}>Sign Out</button>
      </div>

      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}

      {shareLink && (
        <div style={styles.shareLinkBox}>
          <strong>Share Link (expires in 24 hours):</strong>
          <input style={styles.shareLinkInput} value={shareLink} readOnly
            onClick={e => e.target.select()} />
          <button style={styles.copyButton}
            onClick={() => { navigator.clipboard.writeText(shareLink); setSuccess('Link copied!'); }}>
            Copy
          </button>
        </div>
      )}

      <div style={styles.tabs}>
        <button style={activeTab === 'myFiles' ? styles.activeTab : styles.tab}
          onClick={() => { setActiveTab('myFiles'); loadFiles(); }}>
          My Files
        </button>
        <button style={activeTab === 'sharedWithMe' ? styles.activeTab : styles.tab}
          onClick={() => { setActiveTab('sharedWithMe'); loadSharedFiles(); }}>
          Shared With Me
        </button>
      </div>

      {activeTab === 'myFiles' && (
        <>
          <div style={styles.uploadBox}>
            <h2>Upload File</h2>
            <input type="file" onChange={handleFileUpload} disabled={uploading} />
            {uploading && <p>Uploading...</p>}
          </div>

          <div style={styles.filesBox}>
            <h2>Your Files</h2>
            {files.length === 0 ? (
              <p>No files uploaded yet.</p>
            ) : (
              files.map(file => (
                <div key={file.secureID} style={styles.fileItem}>
                  <div style={{flex: 1}}>
                    <strong>{file.fileName}</strong>
                    <p style={styles.fileDate}>
                      {new Date(file.uploadedAt).toLocaleString()}
                    </p>
                    {sharingFileId === file.secureID && (
                      <div style={styles.shareRow}>
                        <input style={styles.shareInput}
                          placeholder="Enter email to share with"
                          value={shareEmail}
                          onChange={e => setShareEmail(e.target.value)} />
                        <button style={styles.shareButton}
                          onClick={() => handleShare(file.secureID)}>
                          Share
                        </button>
                        <button style={styles.cancelButton}
                          onClick={() => setSharingFileId(null)}>
                          Cancel
                        </button>
                      </div>
                    )}
                    {selectedFile === file.secureID && (
                      <div style={styles.commentsBox}>
                        <strong>Comments:</strong>
                        {comments.length === 0 ? <p>No comments yet.</p> : (
                          comments.map(c => (
                            <div key={c.commentId} style={styles.comment}>
                              <p style={styles.commentText}>{c.comment}</p>
                              <p style={styles.commentDate}>
                                {new Date(c.createdAt).toLocaleString()}
                              </p>
                            </div>
                          ))
                        )}
                        <div style={styles.shareRow}>
                          <input style={styles.shareInput}
                            placeholder="Add a comment..."
                            value={commentText}
                            onChange={e => setCommentText(e.target.value)} />
                          <button style={styles.shareButton}
                            onClick={() => handleAddComment(file.secureID)}>
                            Add
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={styles.fileActions}>
                    <button style={styles.actionButton}
                      onClick={() => handleDownload(file.secureID)}>
                      Download
                    </button>
                    <button style={styles.actionButton}
                      onClick={() => setSharingFileId(file.secureID)}>
                      Share
                    </button>
                    <button style={styles.actionButton}
                      onClick={() => handleGenerateShareLink(file.secureID)}>
                      Link
                    </button>
                    <button style={styles.actionButton}
                      onClick={() => selectedFile === file.secureID
                        ? setSelectedFile(null)
                        : handleLoadComments(file.secureID)}>
                      Comments
                    </button>
                    <button style={styles.deleteButton}
  onClick={() => {
    if (window.confirm('Are you sure you want to delete this file?')) {
      handleDelete(file.secureID);
    }
  }}>
  Delete
</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {activeTab === 'sharedWithMe' && (
        <div style={styles.filesBox}>
          <h2>Shared With Me</h2>
          {sharedFiles.length === 0 ? (
            <p>No files shared with you yet.</p>
          ) : (
sharedFiles.map(file => (
  <div key={file.SecureSort} style={styles.fileItem}>
    <div style={{flex: 1}}>
      <strong>{file.fileName}</strong>
      <p style={styles.fileDate}>
        Shared by {file.sharedBy} on {new Date(file.sharedAt).toLocaleString()}
      </p>
      {selectedFile === file.secureID && (
        <div style={styles.commentsBox}>
          <strong>Comments:</strong>
          {comments.length === 0 ? <p>No comments yet.</p> : (
            comments.map(c => (
              <div key={c.commentId} style={styles.comment}>
                <p style={styles.commentText}>{c.comment}</p>
                <p style={styles.commentDate}>
                  {new Date(c.createdAt).toLocaleString()}
                </p>
              </div>
            ))
          )}
          <div style={styles.shareRow}>
            <input style={styles.shareInput}
              placeholder="Add a comment..."
              value={commentText}
              onChange={e => setCommentText(e.target.value)} />
            <button style={styles.shareButton}
              onClick={() => handleAddComment(file.secureID)}>
              Add
            </button>
          </div>
        </div>
      )}
    </div>
    <div style={styles.fileActions}>
      <button style={styles.actionButton}
        onClick={() => handleDownload(file.secureID)}>
        Download
      </button>
      <button style={styles.actionButton}
        onClick={() => selectedFile === file.secureID
          ? setSelectedFile(null)
          : handleLoadComments(file.secureID)}>
        Comments
      </button>
    </div>
  </div>
))
          )}
        </div>
      )}
    </div>
  );
}