import React, { useState, useEffect, useMemo } from 'react';
import { files } from '../../utils/api';
import { FaUpload, FaTrash, FaSpinner, FaEdit } from 'react-icons/fa';

function FilesPage() {
    const [fileList, setFileList] = useState([]);
    const [selectedFile, setSelectedFile] = useState(null);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [error, setError] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [loading, setLoading] = useState(true);
    const [editingFile, setEditingFile] = useState(null);
    const [editName, setEditName] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editSelectedFile, setEditSelectedFile] = useState(null);

    useEffect(() => {
        loadFiles();
    }, []);

    const loadFiles = async () => {
        try {
            setLoading(true);
            const response = await files.all();
            setFileList(response.data);
            setError(null);
        } catch (err) {
            handleError(err);
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedFile(file);
            if (!name) {
                setName(file.name);
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedFile) {
            setError('Vui lòng chọn file');
            return;
        }
        if (!name) {
            setError('Vui lòng nhập tên file');
            return;
        }

        setUploading(true);
        try {
            const formDataToSend = new FormData();
            formDataToSend.append('file', selectedFile);
            formDataToSend.append('name', name);
            if (description) {
                formDataToSend.append('description', description);
            }

            await files.create(formDataToSend);
            
            setSelectedFile(null);
            setName('');
            setDescription('');
            setError(null);
            await loadFiles();
        } catch (err) {
            console.error('Upload error:', err);
            setError(err.response?.data?.error || 'Không thể tải file lên');
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id, fileName) => {
        if (!window.confirm(`Bạn có chắc chắn muốn xóa file "${fileName}"?`)) {
            return;
        }
        
        setDeleting(true);
        try {
            await files.delete(id);
            setError(null);
            loadFiles();
        } catch (err) {
            handleError(err);
        } finally {
            setDeleting(false);
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleString('vi-VN', {
            dateStyle: 'medium',
            timeStyle: 'short'
        });
    };

    const sortedFiles = useMemo(() => {
        return [...fileList].sort((a, b) => 
            new Date(b.created_at) - new Date(a.created_at)
        );
    }, [fileList]);

    const handleEdit = (file) => {
        setEditingFile(file);
        setEditName(file.name);
        setEditDescription(file.description || '');
        setEditSelectedFile(null);
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        if (!editName) {
            setError('Vui lòng nhập tên file');
            return;
        }

        setUploading(true);
        try {
            await files.update(editingFile.id, {
                file: editSelectedFile,
                name: editName,
                description: editDescription
            });
            
            setEditingFile(null);
            setEditName('');
            setEditDescription('');
            setEditSelectedFile(null);
            setError(null);
            await loadFiles();
        } catch (err) {
            console.error('Update error:', err);
            setError(err.response?.data?.error || 'Không thể cập nhật file');
        } finally {
            setUploading(false);
        }
    };

    const handleEditFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setEditSelectedFile(file);
        }
    };

    return (
        <div className="container mx-auto px-6 py-8">
            <h1 className="text-3xl font-semibold text-gray-800 mb-6">Files Management</h1>
            
            {error && (
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded shadow">
                    <p className="font-medium">Error</p>
                    <p>{error}</p>
                </div>
            )}
            
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                <h2 className="text-xl font-semibold mb-4">Upload New File</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                File
                            </label>
                            <input
                                type="file"
                                onChange={handleFileChange}
                                className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Name
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                                placeholder="Enter file name"
                                required
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Description
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                            placeholder="Enter file description"
                            rows={3}
                        />
                    </div>
                    <div>
                        <button
                            type="submit"
                            disabled={uploading}
                            className={`flex items-center justify-center gap-2 w-full md:w-auto px-6 py-2 ${
                                uploading
                                    ? 'bg-gray-400'
                                    : 'bg-blue-500 hover:bg-blue-600'
                            } text-white font-medium rounded transition duration-200`}
                        >
                            {uploading ? (
                                <FaSpinner className="animate-spin" />
                            ) : (
                                <FaUpload />
                            )}
                            {uploading ? 'Uploading...' : 'Upload File'}
                        </button>
                    </div>
                </form>
            </div>

            <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Name
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Description
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Uploaded By
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Upload Date
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {sortedFiles.map((file) => (
                            <tr key={file.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {file.name}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500">
                                    {file.description || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {file.full_name}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {formatDate(file.created_at)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <div className="flex justify-end gap-2">
                                        <button
                                            onClick={() => handleEdit(file)}
                                            className="text-blue-600 hover:text-blue-900 transition duration-200"
                                        >
                                            <FaEdit />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(file.id, file.name)}
                                            disabled={deleting}
                                            className="text-red-600 hover:text-red-900 transition duration-200"
                                        >
                                            <FaTrash />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {!loading && fileList.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                    Chưa có file nào được tải lên
                </div>
            )}

            {/* Edit Modal */}
            {editingFile && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center">
                    <div className="bg-white rounded-lg p-8 max-w-2xl w-full">
                        <h2 className="text-xl font-semibold mb-4">Edit File</h2>
                        <form onSubmit={handleUpdate} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    File
                                </label>
                                <input
                                    type="file"
                                    onChange={handleEditFileChange}
                                    className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                                />
                                <p className="text-sm text-gray-500 mt-1">
                                    Current file: {editingFile.name}
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Name
                                </label>
                                <input
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Description
                                </label>
                                <textarea
                                    value={editDescription}
                                    onChange={(e) => setEditDescription(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                                    rows={3}
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setEditingFile(null)}
                                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={uploading}
                                    className={`flex items-center justify-center gap-2 px-6 py-2 ${
                                        uploading
                                            ? 'bg-gray-400'
                                            : 'bg-blue-500 hover:bg-blue-600'
                                    } text-white font-medium rounded transition duration-200`}
                                >
                                    {uploading ? (
                                        <FaSpinner className="animate-spin" />
                                    ) : (
                                        'Save Changes'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default FilesPage; 