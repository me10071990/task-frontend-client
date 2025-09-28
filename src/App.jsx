import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = 'http://127.0.0.1:8000/api/tasks';

function App() {

    const [tasks, setTasks] = useState([]);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskDescription, setNewTaskDescription] = useState('');
    const [loading, setLoading] = useState(true);
    
    // Bulk Import State
    const [bulkInput, setBulkInput] = useState(''); 
    const [bulkTitle, setBulkTitle] = useState(''); 

    // --- CHUNKED UPLOAD STATE ---
 
    const [selectedFiles, setSelectedFiles] = useState([]); 
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploading, setUploading] = useState(false);
    
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

    // --- API CALLS (CRUD) ---

    const fetchTasks = async () => {
        try {
            const response = await axios.get(API_URL);
            setTasks(response.data);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching tasks:', error);
            setLoading(false);
        }
    };

    const addTask = async (e) => {
        e.preventDefault(); 
        if (!newTaskTitle.trim()) return; 
        const newTask = { title: newTaskTitle, description: newTaskDescription };
        try {
            const response = await axios.post(API_URL, newTask);
            setTasks([...tasks, response.data]);
            setNewTaskTitle('');
            setNewTaskDescription('');
        } catch (error) {
            console.error('Error adding task:', error);
        }
    };

    const deleteTask = async (id) => {
        try {
            await axios.delete(`${API_URL}/${id}`);
            setTasks(tasks.filter(task => task.id !== id));
        } catch (error) {
            console.error('Error deleting task:', error);
        }
    };
    


// 4. Handle Bulk Import (POST /api/tasks/bulk)
const handleBulkImport = async () => {
    let parsedTasks;

    try {
      
        parsedTasks = JSON.parse(bulkInput);
        
     
        if (!Array.isArray(parsedTasks)) {
            alert('Error: JSON must be a in array (e.g., [{}]).');
            return;
        }

    } catch (error) {
      
        console.error('JSON Parsing Error:', error);
        alert('Error:Syntax Eror(").');
        return; 
    }

  
    try {
        const bulkData = { tasks: parsedTasks };

      
        await axios.post(`${API_URL}/bulk`, bulkData); 
        
        setBulkInput('');
        setBulkTitle(''); 
        fetchTasks();
        alert('Bulk import successful!');

    } catch (error) {
      
        console.error('API Bulk Import Failed:', error.response?.data?.errors || error);
        alert('Bulk import failed due to API error. Check if all tasks have a "title" field, and see console for details.'); 
    }
};


    // --- CHUNKED UPLOAD LOGIC ---
    
    const handleFileChange = (e) => {
      
        const newFiles = Array.from(e.target.files).map(file => ({
            file: file,
            id: URL.createObjectURL(file) + Date.now(), 
            name: file.name
        }));
        setSelectedFiles(prevFiles => [...prevFiles, ...newFiles]);
        e.target.value = null;
    };

    const removeFile = (fileId) => {
        setSelectedFiles(prevFiles => prevFiles.filter(f => f.id !== fileId));
    };


    const startChunkedUpload = async () => {
        if (selectedFiles.length === 0) {
            alert('Please select files first.');
            return;
        }

        setUploading(true);
        setUploadProgress(0);

        const totalFiles = selectedFiles.length;
        let completedFiles = 0;

        for (const fileItem of selectedFiles) {
            const file = fileItem.file;
            const totalSize = file.size;
            const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);
            const fileId = Date.now().toString() + '_' + file.name.replace(/[^a-zA-Z0-9]/g, '');

            let uploadedChunks = 0;

            for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
                const start = chunkIndex * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, totalSize);
                const chunk = file.slice(start, end);

                const formData = new FormData();
                formData.append('file_id', fileId);
                formData.append('chunk_index', chunkIndex);
                formData.append('total_chunks', totalChunks);
                formData.append('file_name', file.name.split('.').slice(0, -1).join('.'));
                formData.append('file', chunk); 
                
                try {
                    await axios.post('http://127.0.0.1:8000/api/upload/chunk', formData, {
                        headers: { 'Content-Type': 'multipart/form-data' },
                    });
                    
                    uploadedChunks++;
                    const fileProgress = (uploadedChunks / totalChunks);
                    const overallProgress = (completedFiles + fileProgress) / totalFiles;
                    setUploadProgress(Math.round(overallProgress * 100));

                } catch (error) {
                    console.error(`Error uploading chunk ${chunkIndex} for file ${file.name}:`, error);
                    alert(`Upload failed on chunk for file: ${file.name}. See console.`);
                    setUploading(false);
                    return; 
                }
            }
            
            try {
                const combineResponse = await axios.post('http://127.0.0.1:8000/api/upload/combine', { file_id: fileId });
                console.log(`File ${file.name} combined successfully! URL: ${combineResponse.data.url}`);
                completedFiles++;
                
            } catch (error) {
                console.error(`Error combining chunks for file ${file.name}:`, error);
                alert(`File combination failed for: ${file.name}.`);
            }
        }
        
        alert(`All ${totalFiles} files uploaded and combined successfully!`);
        setUploading(false);
        setSelectedFiles([]); 
    };


    useEffect(() => {
        fetchTasks();
    }, []); 

    if (loading) {
        return <h1>Loading Tasks...</h1>;
    }

    return (
        <div className="container">
            <header className="app-header">
                <h1>Full Stack Development Assessment</h1>
            </header>

            <div className="main-content">
                
                <div className="card task-form-card">
                    <h2>1. Add New Task</h2>
                    <form onSubmit={addTask} className="task-form">
                        <input
                            type="text"
                            placeholder="Task Title (Required)"
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            required
                        />
                        <textarea
                            placeholder="Task Description (Optional)"
                            value={newTaskDescription}
                            onChange={(e) => setNewTaskDescription(e.target.value)}
                        ></textarea>
                        <button type="submit">Add Task</button>
                    </form>
                </div>

                
                {/* Bulk Import */}
                <div className="card bulk-import-section">
                    <h2>2. Bulk Import (JSON)</h2>
                    <input
                        type="text"
                        placeholder="Bulk Operation Title (Optional)"
                        value={bulkTitle}
                        onChange={(e) => setBulkTitle(e.target.value)}
                    />
                    <textarea
                        placeholder='Enter JSON array of tasks: [{"title": "Task 1"}, {"title": "Task 2", "description": "Desc 2"}]'
                        value={bulkInput}
                        onChange={(e) => setBulkInput(e.target.value)}
                        rows="5"
                        cols="50"
                    ></textarea>
                    <button onClick={handleBulkImport}>Import Tasks</button>
                    <p className="hint">JSON Format required.</p>
                </div>


                
                {/* chunked image /pdf upload section */}
                <div className="card chunk-upload-section">
                    <h2>3. Chunked File Upload (Multiple Files)</h2>
                    <div className="upload-controls">
                        <input 
                            type="file" 
                            onChange={handleFileChange} 
                            disabled={uploading}
                            multiple 
                        />
                        <button 
                            onClick={startChunkedUpload} 
                            disabled={selectedFiles.length === 0 || uploading}
                        >
                            {uploading 
                                ? `Uploading (${uploadProgress}%)` 
                                : `Start Upload (${selectedFiles.length} files)`
                            }
                        </button>
                    </div>

                    {/*  display  json and bulk value*/}
                    {selectedFiles.length > 0 && (
                        <ul className="file-list">
                            {selectedFiles.map((fileItem, index) => (
                                <li key={fileItem.id} className="file-item">
                                    <span className="file-index">{index + 1}.</span>
                                    <span className="file-name">{fileItem.name}</span>
                                    <button 
                                        onClick={() => removeFile(fileItem.id)} 
                                        className="remove-file-button"
                                        disabled={uploading}
                                    >
                                        X
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}

                    {/* progress bar  - when any process*/}
                    {uploading && (
                        <div className="progress-bar-container">
                            <div 
                                className="progress-bar-fill" 
                                style={{ width: `${uploadProgress}%` }}
                            >
                                {uploadProgress}%
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Task List Display - for 2 scections*/}
            <div className="task-list">
                <h2>My Tasks List</h2>
                {tasks.length === 0 ? (
                    <p>No tasks found. Add one above!</p>
                ) : (
                    <ul>
                        {tasks.map(task => (
                            <li key={task.id} className="task-item">
                                <div className="task-content">
                                    <h3>{task.title}</h3>
                                    <p>{task.description}</p>
                                </div>
                                <button 
                                    onClick={() => deleteTask(task.id)} 
                                    className="delete-button"
                                >
                                    Delete
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

export default App;