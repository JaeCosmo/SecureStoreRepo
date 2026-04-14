import { Amplify } from 'aws-amplify';
import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';
import { signIn, signUp, signOut, confirmSignUp, getCurrentUser, resetPassword, confirmResetPassword } from 'aws-amplify/auth';
import logo from './logo.png';
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

  useEffect(() => {
  if (success || error) {
    const timer = setTimeout(() => {
      setSuccess('');
      setError('');
    }, 3000);
    return () => clearTimeout(timer);
  }
}, [success, error]);

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
      const userEmail = currentUser.signInDetails?.loginId || currentUser.username;
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

  // ── Color tokens ──────────────────────────────────────────────
  const NAVY   = '#0d1b6e';
  const TEAL   = '#00c2b2';
  const TEAL2  = '#00a89a';   // slightly darker teal for hover feel
  const WHITE  = '#ffffff';
  const LIGHT  = '#f0f4f8';
  const BORDER = '#dce3ec';
  const RED    = '#dc3545';

  const styles = {
    // ── Layout ──────────────────────────────────────────────────
    container: {
      maxWidth: '860px',
      margin: '0 auto',
      padding: '24px 20px',
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      color: '#1a1a2e',
    },
    authBox: {
      maxWidth: '420px',
      margin: '80px auto',
      padding: '44px 40px',
      boxShadow: '0 8px 32px rgba(13,27,110,0.13)',
      borderRadius: '16px',
      background: WHITE,
      textAlign: 'center',
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '28px',
      paddingBottom: '16px',
      borderBottom: `2px solid ${TEAL}`,
    },
    logoRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    },
    logoImg: {
      width: '44px',
      height: '44px',
      objectFit: 'contain',
    },
    logoImgAuth: {
      width: '72px',
      height: '72px',
      objectFit: 'contain',
      marginBottom: '8px',
    },

    // ── Typography ───────────────────────────────────────────────
    title: {
      color: NAVY,
      fontWeight: '700',
      fontSize: '1.6rem',
      margin: 0,
      letterSpacing: '-0.5px',
    },
    subtitle: {
      color: '#5a6380',
      marginBottom: '24px',
      fontSize: '0.95rem',
    },

    // ── Inputs ───────────────────────────────────────────────────
    input: {
      width: '100%',
      padding: '11px 14px',
      marginBottom: '12px',
      border: `1.5px solid ${BORDER}`,
      borderRadius: '8px',
      boxSizing: 'border-box',
      fontSize: '0.95rem',
      outline: 'none',
      transition: 'border-color 0.2s',
    },
    shareInput: {
      flex: 1,
      padding: '8px 12px',
      border: `1.5px solid ${BORDER}`,
      borderRadius: '8px',
      fontSize: '0.9rem',
    },
    shareLinkInput: {
      flex: 1,
      padding: '8px 12px',
      border: `1.5px solid ${BORDER}`,
      borderRadius: '8px',
      minWidth: '200px',
      fontSize: '0.88rem',
    },

    // ── Buttons ──────────────────────────────────────────────────
    button: {
      width: '100%',
      padding: '11px',
      background: `linear-gradient(135deg, ${NAVY} 0%, #1a2f9e 100%)`,
      color: WHITE,
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '1rem',
      fontWeight: '600',
      letterSpacing: '0.3px',
      marginBottom: '4px',
    },
    signOutButton: {
      padding: '8px 18px',
      background: NAVY,
      color: WHITE,
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      fontWeight: '600',
      fontSize: '0.9rem',
    },
    deleteButton: {
      padding: '6px 13px',
      background: RED,
      color: WHITE,
      border: 'none',
      borderRadius: '7px',
      cursor: 'pointer',
      fontSize: '0.85rem',
      fontWeight: '500',
    },
    actionButton: {
      padding: '6px 13px',
      background: `linear-gradient(135deg, ${TEAL} 0%, ${TEAL2} 100%)`,
      color: WHITE,
      border: 'none',
      borderRadius: '7px',
      cursor: 'pointer',
      fontSize: '0.85rem',
      fontWeight: '500',
    },
    shareButton: {
      padding: '8px 14px',
      background: NAVY,
      color: WHITE,
      border: 'none',
      borderRadius: '7px',
      cursor: 'pointer',
      fontSize: '0.88rem',
      fontWeight: '500',
    },
    cancelButton: {
      padding: '8px 14px',
      background: '#95a5a6',
      color: WHITE,
      border: 'none',
      borderRadius: '7px',
      cursor: 'pointer',
      fontSize: '0.88rem',
    },
    copyButton: {
      padding: '8px 14px',
      background: `linear-gradient(135deg, ${TEAL} 0%, ${TEAL2} 100%)`,
      color: WHITE,
      border: 'none',
      borderRadius: '7px',
      cursor: 'pointer',
      fontSize: '0.88rem',
      fontWeight: '500',
    },

    // ── Tabs ─────────────────────────────────────────────────────
    tabs: {
      display: 'flex',
      marginBottom: '24px',
      gap: '10px',
    },
    tab: {
      padding: '10px 22px',
      background: LIGHT,
      border: `1.5px solid ${BORDER}`,
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '0.95rem',
      fontWeight: '500',
      color: '#5a6380',
    },
    activeTab: {
      padding: '10px 22px',
      background: NAVY,
      color: WHITE,
      border: `1.5px solid ${NAVY}`,
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '0.95rem',
      fontWeight: '600',
    },

    // ── Alerts ───────────────────────────────────────────────────
    error: {
      background: '#fde8e8',
      color: '#c0392b',
      padding: '11px 14px',
      borderRadius: '8px',
      marginBottom: '14px',
      fontSize: '0.92rem',
      borderLeft: '4px solid #e74c3c',
    },
    success: {
      background: '#e6faf8',
      color: '#00796b',
      padding: '11px 14px',
      borderRadius: '8px',
      marginBottom: '14px',
      fontSize: '0.92rem',
      borderLeft: `4px solid ${TEAL}`,
    },

    // ── Boxes ────────────────────────────────────────────────────
    uploadBox: {
      background: WHITE,
      padding: '22px 24px',
      borderRadius: '12px',
      marginBottom: '22px',
      border: `1.5px solid ${BORDER}`,
      boxShadow: '0 2px 8px rgba(13,27,110,0.06)',
    },
    filesBox: {
      background: WHITE,
      padding: '22px 24px',
      borderRadius: '12px',
      border: `1.5px solid ${BORDER}`,
      boxShadow: '0 2px 8px rgba(13,27,110,0.06)',
    },
    fileItem: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      padding: '14px 16px',
      background: LIGHT,
      borderRadius: '10px',
      marginBottom: '12px',
      boxShadow: '0 1px 4px rgba(13,27,110,0.07)',
      borderLeft: `4px solid ${TEAL}`,
    },
    fileDate: {
      color: '#7a86a0',
      fontSize: '12px',
      margin: '4px 0 0 0',
    },
    fileActions: {
      display: 'flex',
      gap: '7px',
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
    },

    // ── Comments ─────────────────────────────────────────────────
    commentsBox: {
      marginTop: '12px',
      padding: '12px 14px',
      background: WHITE,
      borderRadius: '8px',
      border: `1px solid ${BORDER}`,
    },
    comment: {
      padding: '7px 0',
      borderBottom: `1px solid ${BORDER}`,
    },
    commentText: { margin: '0 0 3px 0', fontSize: '0.92rem' },
    commentDate: { margin: 0, fontSize: '11px', color: '#9aa0b0' },

    // ── Misc ─────────────────────────────────────────────────────
    toggle: { textAlign: 'center', marginTop: '10px', fontSize: '0.9rem', color: '#5a6380' },
    link: { color: TEAL, cursor: 'pointer', textDecoration: 'underline', fontWeight: '500' },
    shareRow: { display: 'flex', gap: '8px', marginTop: '10px', alignItems: 'center' },
    shareLinkBox: {
      background: '#e6faf8',
      padding: '14px 16px',
      borderRadius: '10px',
      marginBottom: '18px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      flexWrap: 'wrap',
      border: `1px solid ${TEAL}`,
    },
    sectionTitle: {
      color: NAVY,
      marginTop: 0,
      marginBottom: '16px',
      fontWeight: '700',
      fontSize: '1.1rem',
    },
  };

  // ── Auth screen ──────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div style={{ background: `linear-gradient(135deg, #e8edf8 0%, #d8f5f3 100%)`, minHeight: '100vh' }}>
        <div style={styles.authBox}>
          <img src={logo} alt="SecureStore logo" style={styles.logoImgAuth} />
          <h1 style={styles.title}>SecureStore</h1>
          <p style={styles.subtitle}>Secure file storage &amp; collaboration</p>

          {error   && <div style={styles.error}>{error}</div>}
          {success && <div style={styles.success}>{success}</div>}

          {needsConfirmation ? (
            <>
              <p style={{ color: '#5a6380', fontSize: '0.92rem' }}>
                Enter the confirmation code sent to <strong>{email}</strong>
              </p>
              <input style={styles.input} placeholder="Confirmation code"
                value={confirmCode} onChange={e => setConfirmCode(e.target.value)} />
              <button style={styles.button} onClick={handleConfirm}>Confirm Account</button>
            </>
          ) : (
            <>
              <input style={styles.input} placeholder="Email"
                value={email} onChange={e => setEmail(e.target.value)} />

              {authMode === 'signin' ? (
                <>
                  {!forgotPasswordMode ? (
                    <>
                      <input style={styles.input} placeholder="Password" type="password"
                        value={password} onChange={e => setPassword(e.target.value)} />
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
                  <input style={styles.input} placeholder="Password" type="password"
                    value={password} onChange={e => setPassword(e.target.value)} />
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

  // ── Main app ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: `linear-gradient(160deg, #f0f4f8 0%, #e6faf8 100%)`, minHeight: '100vh' }}>
      <div style={styles.container}>

        {/* Header */}
        <div style={styles.header}>
          <div style={styles.logoRow}>
            <img src={logo} alt="SecureStore logo" style={styles.logoImg} />
            <h1 style={styles.title}>SecureStore</h1>
          </div>
          <button style={styles.signOutButton} onClick={handleSignOut}>Sign Out</button>
        </div>

        {error   && <div style={styles.error}>{error}</div>}
        {success && <div style={styles.success}>{success}</div>}

        {shareLink && (
          <div style={styles.shareLinkBox}>
            <strong style={{ color: NAVY }}>Share Link (expires in 24 hours):</strong>
            <input style={styles.shareLinkInput} value={shareLink} readOnly
              onClick={e => e.target.select()} />
            <button style={styles.copyButton}
              onClick={() => { navigator.clipboard.writeText(shareLink); setSuccess('Link copied!'); }}>
              Copy
            </button>
          </div>
        )}

        {/* Tabs */}
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

        {/* My Files tab */}
        {activeTab === 'myFiles' && (
          <>
            <div style={styles.uploadBox}>
              <h2 style={styles.sectionTitle}>Upload File</h2>
              <input type="file" onChange={handleFileUpload} disabled={uploading} />
              {uploading && <p style={{ color: TEAL, marginTop: '8px' }}>Uploading…</p>}
            </div>

            <div style={styles.filesBox}>
              <h2 style={styles.sectionTitle}>Your Files</h2>
              {files.length === 0 ? (
                <p style={{ color: '#7a86a0' }}>No files uploaded yet.</p>
              ) : (
                files.map(file => (
                  <div key={file.secureID} style={styles.fileItem}>
                    <div style={{ flex: 1 }}>
                      <strong style={{ color: NAVY }}>{file.fileName}</strong>
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
                            onClick={() => handleShare(file.secureID)}>Share</button>
                          <button style={styles.cancelButton}
                            onClick={() => setSharingFileId(null)}>Cancel</button>
                        </div>
                      )}

                      {selectedFile === file.secureID && (
                        <div style={styles.commentsBox}>
                          <strong style={{ color: NAVY }}>Comments:</strong>
                          {comments.length === 0 ? <p style={{ color: '#7a86a0' }}>No comments yet.</p> : (
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
                              placeholder="Add a comment…"
                              value={commentText}
                              onChange={e => setCommentText(e.target.value)} />
                            <button style={styles.shareButton}
                              onClick={() => handleAddComment(file.secureID)}>Add</button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={styles.fileActions}>
                      <button style={styles.actionButton}
                        onClick={() => handleDownload(file.secureID)}>Download</button>
                      <button style={styles.actionButton}
                        onClick={() => setSharingFileId(file.secureID)}>Share</button>
                      <button style={styles.actionButton}
                        onClick={() => handleGenerateShareLink(file.secureID)}>Link</button>
                      <button style={styles.actionButton}
                        onClick={() => selectedFile === file.secureID
                          ? setSelectedFile(null)
                          : handleLoadComments(file.secureID)}>Comments</button>
                      <button style={styles.deleteButton}
                        onClick={() => {
                          if (window.confirm('Are you sure you want to delete this file?')) {
                            handleDelete(file.secureID);
                          }
                        }}>Delete</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* Shared With Me tab */}
        {activeTab === 'sharedWithMe' && (
          <div style={styles.filesBox}>
            <h2 style={styles.sectionTitle}>Shared With Me</h2>
            {sharedFiles.length === 0 ? (
              <p style={{ color: '#7a86a0' }}>No files shared with you yet.</p>
            ) : (
              sharedFiles.map(file => (
                <div key={file.SecureSort} style={styles.fileItem}>
                  <div style={{ flex: 1 }}>
                    <strong style={{ color: NAVY }}>{file.fileName}</strong>
                    <p style={styles.fileDate}>
                      Shared by {file.sharedBy} on {new Date(file.sharedAt).toLocaleString()}
                    </p>
                    {selectedFile === file.secureID && (
                      <div style={styles.commentsBox}>
                        <strong style={{ color: NAVY }}>Comments:</strong>
                        {comments.length === 0 ? <p style={{ color: '#7a86a0' }}>No comments yet.</p> : (
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
                            placeholder="Add a comment…"
                            value={commentText}
                            onChange={e => setCommentText(e.target.value)} />
                          <button style={styles.shareButton}
                            onClick={() => handleAddComment(file.secureID)}>Add</button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={styles.fileActions}>
                    <button style={styles.actionButton}
                      onClick={() => handleDownload(file.secureID)}>Download</button>
                    <button style={styles.actionButton}
                      onClick={() => selectedFile === file.secureID
                        ? setSelectedFile(null)
                        : handleLoadComments(file.secureID)}>Comments</button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

      </div>
    </div>
  );
}
