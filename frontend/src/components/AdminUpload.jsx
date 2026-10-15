/**
 * @file AdminUpload.jsx
 * @summary Admin component to upload and link video solutions/editorials to coding challenges. 
 *          It generates a secure signature from the backend, uploads the video file directly to Cloudinary 
 *          with real-time progress indicators, and saves metadata (URL, duration, public ID) back to the database.
 *          Includes drag-and-drop input validation and video playback preview using browser Object URLs.
 * 
 * @functions
 * - AdminUpload: Main functional component that binds form inputs, monitors file selections, and handles upload flows.
 * - useEffect (Preview): Manages local object URLs via `URL.createObjectURL` and `URL.revokeObjectURL` to display video previews.
 * - onSubmit: Orchestrates the signature request, direct Cloudinary API multi-part upload (with progress tracking), and backend save call.
 * - formatFileSize: Utility to format file sizes in bytes into readable formats (Bytes, KB, MB, GB).
 * - formatDuration: Utility to format video durations from numeric seconds to a "MM:SS" time string.
 */

import { useParams, NavLink } from 'react-router';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import axios from 'axios';
import axiosClient from '../utils/axiosClient';
import AppShell from './layout/AppShell';
import { ArrowLeft, UploadCloud, Video, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

function AdminUpload(){
    const { problemId }  = useParams();
    
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadedVideo, setUploadedVideo] = useState(null);
    const [videoPreview, setVideoPreview] = useState(null);
    
    const {
        register,
        handleSubmit,
        watch,
        formState: { errors },
        reset,
        setError,
        clearErrors
    } = useForm();
    
    const selectedFile = watch('videoFile')?.[0];

    // Show preview logic
    React.useEffect(() => {
        if (selectedFile) {
            const objectUrl = URL.createObjectURL(selectedFile);
            setVideoPreview(objectUrl);
            return () => URL.revokeObjectURL(objectUrl);
        } else {
            setVideoPreview(null);
        }
    }, [selectedFile]);
    
    // Upload video to Cloudinary
    const onSubmit = async (data) => {
        const file = data.videoFile[0];
        
        setUploading(true);
        setUploadProgress(0);
        clearErrors();
    
        try {
            const signatureResponse = await axiosClient.get(`/video/create/${problemId}`);
            const { signature, timestamp, public_id, api_key, cloud_name, upload_url } = signatureResponse.data;
    
            const formData = new FormData();
            formData.append('file', file);
            formData.append('signature', signature);
            formData.append('timestamp', timestamp);
            formData.append('public_id', public_id);
            formData.append('api_key', api_key);
    
            const uploadResponse = await axios.post(upload_url, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (progressEvent) => {
                    const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setUploadProgress(progress);
                },
            });
    
            const cloudinaryResult = uploadResponse.data;
    
            const metadataResponse = await axiosClient.post('/video/save', {
                problemId: problemId,
                cloudinaryPublicId: cloudinaryResult.public_id,
                secureUrl: cloudinaryResult.secure_url,
                duration: cloudinaryResult.duration,
            });
    
            setUploadedVideo(metadataResponse.data.videoSolution || metadataResponse.data);
            reset(); 
        } catch (err) {
            console.error('Upload error:', err);
            setError('root', {
                type: 'manual',
                message: err.response?.data?.message || err.response?.data || 'Upload failed. Please try again.'
            });
        } finally {
            setUploading(false);
            setUploadProgress(0);
        }
    };
    
    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };
    
    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };
    
    return (
        <AppShell
            title="Upload Editorial Video"
            subtitle="Publish a step-by-step video editorial detailing the problem logic and code walkthrough."
            actions={
                <NavLink to="/admin" className="premium-muted-button px-4 py-2 text-xs flex items-center gap-1.5 no-underline">
                    <ArrowLeft size={13} />
                    <span>Admin Workbench</span>
                </NavLink>
            }
        >
            <div className="max-w-2xl mx-auto pb-12 animate-fade-up">
                <section className="premium-card overflow-hidden bg-slate-900/60 border border-white/8 shadow-xl">
                    <div className="px-5 py-4 border-b border-white/8 bg-slate-900/40 flex items-center gap-2">
                        <Video size={16} className="text-emerald-400" />
                        <h2 className="text-sm font-black text-white font-heading tracking-tight">Upload Video Solution</h2>
                    </div>

                    <div className="p-5 bg-slate-950/20">
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                            
                            {/* File Upload Area */}
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Select Video File</label>
                                <label className={`flex justify-center w-full h-44 px-4 transition bg-slate-950/40 border-2 border-dashed rounded-2xl appearance-none cursor-pointer hover:border-emerald-500/30 focus:outline-none ${errors.videoFile ? 'border-red-400 bg-red-500/5' : 'border-white/10'} ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                    <span className="flex items-center space-x-2">
                                        <UploadCloud size={24} className="text-slate-500 animate-glow-pulse" />
                                        <span className="text-xs font-semibold text-slate-400">
                                            Drop video here or <span className="text-emerald-400 underline">browse files</span>
                                        </span>
                                    </span>
                                    <input
                                        type="file"
                                        name="file_upload"
                                        className="hidden"
                                        accept="video/*"
                                        disabled={uploading}
                                        {...register('videoFile', {
                                            required: 'Please select a video file',
                                            validate: {
                                                isVideo: (files) => {
                                                    if (!files || !files[0]) return 'Please select a video file';
                                                    return files[0].type.startsWith('video/') || 'Invalid video format';
                                                },
                                                fileSize: (files) => {
                                                    if (!files || !files[0]) return true;
                                                    return files[0].size <= (100 * 1024 * 1024) || 'File must be under 100MB';
                                                }
                                            }
                                        })}
                                    />
                                </label>
                                {errors.videoFile && <span className="text-red-500 text-xs mt-2 block">{errors.videoFile.message}</span>}
                            </div>

                            {/* Video Details & Preview */}
                            {selectedFile && !uploading && !uploadedVideo && (
                                <div className="rounded-xl border border-white/5 bg-slate-900/40 p-4 flex gap-4 animate-fade-in shadow-inner">
                                    <div className="w-28 h-16 bg-black rounded-lg overflow-hidden shrink-0 shadow-sm border border-white/5">
                                       <video src={videoPreview} className="w-full h-full object-cover opacity-80" />
                                    </div>
                                    <div className="flex flex-col flex-1 justify-center overflow-hidden">
                                        <h3 className="font-bold text-xs text-white truncate">{selectedFile.name}</h3>
                                        <p className="text-[10px] text-slate-500 mt-1 font-semibold">{formatFileSize(selectedFile.size)} • Ready to upload</p>
                                    </div>
                                </div>
                            )}

                            {/* Uploading Progress */}
                            {uploading && (
                                <div className="rounded-xl border border-white/5 bg-slate-900/40 p-5 animate-fade-in space-y-3 shadow-inner">
                                    <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        <span className="flex items-center gap-2">
                                            <Loader2 size={13} className="animate-spin text-emerald-400" />
                                            Uploading...
                                        </span>
                                        <span className="text-emerald-400">{uploadProgress}%</span>
                                    </div>
                                    <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-white/5">
                                        <div className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all duration-300 relative" style={{ width: `${uploadProgress}%` }}>
                                             <div className="absolute top-0 left-0 bottom-0 right-0 bg-white/20 animate-pulse"></div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Success State */}
                            {uploadedVideo && (
                                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5 animate-fade-in shadow-inner">
                                    <h3 className="text-emerald-400 font-black flex items-center gap-2 text-sm leading-none">
                                        <CheckCircle2 size={16} />
                                        Publish Successful
                                    </h3>
                                    <div className="text-xs text-slate-400 space-y-1 mt-2.5 ml-6 font-semibold">
                                        {uploadedVideo.duration && <p>Duration: {formatDuration(uploadedVideo.duration)}</p>}
                                        <p>Uploaded: {new Date(uploadedVideo.uploadedAt || Date.now()).toLocaleString()}</p>
                                    </div>
                                    <div className="mt-4 ml-6">
                                        <button type="button" onClick={() => {setUploadedVideo(null); reset();}} className="premium-button text-[10px] py-1.5 px-3">
                                            Upload Another
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Error Message */}
                            {errors.root && (
                                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-xs font-semibold text-red-400 flex items-start gap-2.5 shadow-inner">
                                    <AlertCircle size={15} className="shrink-0 mt-0.5" />
                                    <span>{errors.root.message}</span>
                                </div>
                            )}

                            <div className="pt-4 border-t border-white/5 flex justify-end">
                                <button
                                    type="submit"
                                    disabled={uploading || !selectedFile}
                                    className={`premium-button w-full sm:w-auto px-8 py-2.5 shadow-md ${uploading || !selectedFile ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg'}`}
                                >
                                    {uploading ? 'Processing...' : 'Publish Video Editorial'}
                                </button>
                            </div>
                        </form>
                    </div>
                </section>
            </div>
        </AppShell>
    );
}

export default AdminUpload;