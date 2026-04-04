import { Amplify } from 'aws-amplify';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: 'us-east-1_dB7LLqLBD',
      userPoolClientId: 'YOUR_NEW_SPA_CLIENT_ID',
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
import React, { useState, useEffect } from 'react';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/api';
import { signIn, signUp, signOut, confirmSignUp, getCurrentUser } from 'aws-amplify/auth';
import './App.css';

const client = generateClient();

// GraphQL operations
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

const getPresignedUrlMutation = `
  mutation GetPresignedUrl($fileName: String!) {
    getPresignedUrl(fileName: $fileName) {
      url
      s3Key
    }
  }
`;

const createFileMutation = `
  mutation CreateFile($fileName: String!) {
    createFile(fileName: $fileName) {
      secureID
      fileName
      uploadedAt
      status
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

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setError('');

    try {
      // Get presigned URL
      const urlResult = await client.graphql({
        query: getPresignedUrlMutation,
        variables: { fileName: file.name }
      });

      const { url } = urlResult.data.getPresignedUrl;

      // Upload directly to S3
      await fetch(url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type }
      });

      // Save metadata to DynamoDB
      await client.graphql({
        query: createFileMutation,
        variables: { fileName: file.name }
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

  // Auth UI
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
                  <button style={styles.button} onClick={handleSignIn}>Sign In</button>
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

  // Main app UI
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>SecureStore</h1>
        <button style={styles.signOutButton} onClick={handleSignOut}>Sign Out</button>
      </div>

      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}

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
              <div>
                <strong>{file.fileName}</strong>
                <p style={styles.fileDate}>
                  {new Date(file.uploadedAt).toLocaleString()}
                </p>
              </div>
              <button style={styles.deleteButton}
                onClick={() => handleDelete(file.secureID)}>
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
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
  fileItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'white', borderRadius: '4px', marginBottom: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
  fileDate: { color: '#666', fontSize: '12px', margin: '4px 0 0 0' },
  toggle: { textAlign: 'center', marginTop: '10px' },
  link: { color: '#ff9900', cursor: 'pointer', textDecoration: 'underline' }
};