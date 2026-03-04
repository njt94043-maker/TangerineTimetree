
import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import FileMigrationTool from "../components/files/FileMigrationTool";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  FileText, 
  Image as ImageIcon, 
  Video, 
  Music, 
  File, 
  Download, 
  ExternalLink, 
  Search, 
  Filter,
  Upload,
  Trash2,
  Eye,
  Loader2,
  FolderOpen,
  Calendar
} from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";

export default function Files() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedSubcategory, setSelectedSubcategory] = useState("all");

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
      } catch (error) {
        // If authentication fails, set user to null but don't redirect.
        // This makes the app public, allowing access without login,
        // but still recognizing logged-in users.
        setUser(null);
      }
    };
    loadUser();
  }, []); // Empty dependency array means it runs once on mount

  const { data: files = [], isLoading } = useQuery({
    queryKey: ['file-storage', user?.email, user?.role], // Include user details in queryKey to re-fetch when user state changes
    queryFn: async ({ queryKey }) => {
      const [, userEmail, userRole] = queryKey; // Extract user info from queryKey
      const allFiles = await base44.entities.FileStorage.list('-created_date');
      
      // If user is admin, they see all files
      if (userRole === 'admin') {
        return allFiles;
      } 
      // If a user is logged in (non-admin), they see their own files and public files
      else if (userEmail) {
        return allFiles.filter(f => 
          f.uploaded_by_email === userEmail || 
          f.visible_to_all === true
        );
      }
      // If no user is logged in (public access), only show files marked as visible_to_all
      else {
        return allFiles.filter(f => f.visible_to_all === true);
      }
    },
    initialData: [],
    // No 'enabled' option needed here, as the queryKey will handle re-fetching when `user` changes.
    // The query will run immediately with `user` as null, then re-run if `user` becomes defined.
  });

  const deleteFileMutation = useMutation({
    mutationFn: (id) => base44.entities.FileStorage.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['file-storage'] });
    },
  });

  const categories = {
    invoices: {
      name: "Invoices",
      icon: FileText,
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/20",
      subcategories: {
        client_invoice: "Client Invoices",
        session_invoice: "Session Musician Invoices",
        other: "Other Invoices"
      }
    },
    receipts: {
      name: "Receipts",
      icon: FileText,
      color: "text-orange-400",
      bgColor: "bg-orange-500/10",
      borderColor: "border-orange-500/20",
      subcategories: {
        expense_receipt: "Expense Receipts",
        purchase_receipt: "Purchase Receipts",
        other: "Other Receipts"
      }
    },
    photos: {
      name: "Photos",
      icon: ImageIcon,
      color: "text-purple-400",
      bgColor: "bg-purple-500/10",
      borderColor: "border-purple-500/20",
      subcategories: {
        live_performance: "Live Performance",
        promo: "Promotional",
        backstage: "Backstage",
        other: "Other Photos"
      }
    },
    videos: {
      name: "Videos",
      icon: Video,
      color: "text-pink-400",
      bgColor: "bg-pink-500/10",
      borderColor: "border-pink-500/20",
      subcategories: {
        live_performance: "Live Performance",
        promo: "Promotional",
        rehearsal: "Rehearsal",
        other: "Other Videos"
      }
    },
    audio: {
      name: "Audio Files",
      icon: Music,
      color: "text-green-400",
      bgColor: "bg-green-500/10",
      borderColor: "border-green-500/20",
      subcategories: {
        song_stems: "Song Stems",
        backing_tracks: "Backing Tracks",
        recordings: "Recordings",
        other: "Other Audio"
      }
    },
    documents: {
      name: "Documents",
      icon: File,
      color: "text-yellow-400",
      bgColor: "bg-yellow-500/10",
      borderColor: "border-yellow-500/20",
      subcategories: {
        contracts: "Contracts",
        agreements: "Agreements",
        setlists: "Setlists",
        other: "Other Documents"
      }
    },
    other: {
      name: "Other",
      icon: File,
      color: "text-gray-400",
      bgColor: "bg-gray-500/10",
      borderColor: "border-gray-500/20",
      subcategories: {
        misc: "Miscellaneous"
      }
    }
  };

  const filteredFiles = files.filter(file => {
    const matchesSearch = !searchTerm || 
      file.file_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      file.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      file.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === "all" || file.category === selectedCategory;
    const matchesSubcategory = selectedSubcategory === "all" || file.subcategory === selectedSubcategory;
    
    return matchesSearch && matchesCategory && matchesSubcategory;
  });

  const groupedFiles = filteredFiles.reduce((acc, file) => {
    const category = file.category || 'other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(file);
    return acc;
  }, {});

  const getFileIcon = (fileType) => {
    switch (fileType) {
      case 'pdf':
      case 'document':
        return FileText;
      case 'image':
        return ImageIcon;
      case 'video':
        return Video;
      case 'audio':
        return Music;
      default:
        return File;
    }
  };

  const getFileSize = (bytes) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleDelete = (file) => {
    if (window.confirm(`Are you sure you want to delete "${file.file_name}"?`)) {
      deleteFileMutation.mutate(file.id);
    }
  };

  const availableSubcategories = selectedCategory !== "all" && categories[selectedCategory]
    ? categories[selectedCategory].subcategories
    : {};

  // If user is null, it means no one is logged in, but the app is public, so we don't show a loader indefinitely.
  // The file fetching (isLoading) is independent of user status now.
  // The initial loader should only be for isLoading data, not waiting for user auth.
  // The condition `if (!user)` that previously rendered a loader is removed.

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">File Storage</h1>
          <p className="text-gray-400">All your band files organized in one place</p>
        </div>

        {/* Migration Tool - show to ALL users */}
        <FileMigrationTool />

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
          {Object.entries(categories).map(([key, cat]) => {
            const count = files.filter(f => f.category === key).length;
            const Icon = cat.icon;
            return (
              <Card key={key} className={`${cat.bgColor} border ${cat.borderColor} cursor-pointer hover:scale-105 transition-transform`} onClick={() => setSelectedCategory(key)}>
                <CardContent className="py-4 text-center">
                  <Icon className={`w-8 h-8 ${cat.color} mx-auto mb-2`} />
                  <div className="text-2xl font-bold text-white">{count}</div>
                  <div className="text-xs text-gray-400">{cat.name}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Filters */}
        <Card className="bg-white/5 backdrop-blur-sm border-white/10 mb-6">
          <CardContent className="py-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search files..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-white/5 border-white/10 text-white pl-10"
                />
              </div>

              <Select value={selectedCategory} onValueChange={(value) => {
                setSelectedCategory(value);
                setSelectedSubcategory("all");
              }}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {Object.entries(categories).map(([key, cat]) => (
                    <SelectItem key={key} value={key}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select 
                value={selectedSubcategory} 
                onValueChange={setSelectedSubcategory}
                disabled={selectedCategory === "all"}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="All Subcategories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subcategories</SelectItem>
                  {Object.entries(availableSubcategories).map(([key, name]) => (
                    <SelectItem key={key} value={key}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(selectedCategory !== "all" || selectedSubcategory !== "all" || searchTerm) && (
              <div className="flex items-center gap-2 mt-4">
                <span className="text-sm text-gray-400">Filters:</span>
                {selectedCategory !== "all" && (
                  <Badge variant="secondary" className="bg-white/10">
                    {categories[selectedCategory].name}
                    <button onClick={() => setSelectedCategory("all")} className="ml-2">×</button>
                  </Badge>
                )}
                {selectedSubcategory !== "all" && (
                  <Badge variant="secondary" className="bg-white/10">
                    {availableSubcategories[selectedSubcategory]}
                    <button onClick={() => setSelectedSubcategory("all")} className="ml-2">×</button>
                  </Badge>
                )}
                {searchTerm && (
                  <Badge variant="secondary" className="bg-white/10">
                    "{searchTerm}"
                    <button onClick={() => setSearchTerm("")} className="ml-2">×</button>
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Files List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
          </div>
        ) : filteredFiles.length === 0 ? (
          <Card className="bg-white/5 backdrop-blur-sm border-white/10">
            <CardContent className="py-20 text-center">
              <FolderOpen className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400 text-lg mb-2">
                {searchTerm || selectedCategory !== "all" ? 'No files found' : 'No files uploaded yet'}
              </p>
              <p className="text-gray-500 text-sm">
                {searchTerm || selectedCategory !== "all" ? 'Try adjusting your filters' : 'Files uploaded through bookings, expenses, and media will appear here'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedFiles).map(([categoryKey, categoryFiles]) => {
              const categoryInfo = categories[categoryKey];
              const Icon = categoryInfo.icon;

              return (
                <motion.div
                  key={categoryKey}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card className={`bg-white/5 backdrop-blur-sm border ${categoryInfo.borderColor}`}>
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <Icon className={`w-5 h-5 ${categoryInfo.color}`} />
                        {categoryInfo.name}
                        <Badge className={`${categoryInfo.bgColor} ${categoryInfo.color} ml-2`}>
                          {categoryFiles.length}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {categoryFiles.map((file) => {
                          const FileIcon = getFileIcon(file.file_type);
                          // Deletion is only allowed for logged-in admins or the uploader
                          // The 'user' object might be null if no one is logged in, so add a check.
                          const canDelete = user && (user.role === 'admin' || file.uploaded_by_email === user.email);

                          return (
                            <div
                              key={file.id}
                              className="flex items-start justify-between p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-all"
                            >
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                <div className={`p-2 rounded-lg ${categoryInfo.bgColor} flex-shrink-0`}>
                                  <FileIcon className={`w-5 h-5 ${categoryInfo.color}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium text-white truncate">{file.file_name}</h4>
                                  {file.description && (
                                    <p className="text-sm text-gray-400 mt-1">{file.description}</p>
                                  )}
                                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-500">
                                    <span>{getFileSize(file.file_size)}</span>
                                    <span>•</span>
                                    <span>Uploaded by {file.uploaded_by_name || file.uploaded_by_email}</span>
                                    <span>•</span>
                                    <span>{format(new Date(file.created_date), 'MMM d, yyyy')}</span>
                                    {file.subcategory && (
                                      <>
                                        <span>•</span>
                                        <Badge variant="outline" className="text-xs">
                                          {categoryInfo.subcategories[file.subcategory] || file.subcategory}
                                        </Badge>
                                      </>
                                    )}
                                    {file.is_private && (
                                      <>
                                        <span>•</span>
                                        <Badge variant="outline" className="text-xs text-orange-400">
                                          Private
                                        </Badge>
                                      </>
                                    )}
                                  </div>
                                  {file.tags && file.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                      {file.tags.map((tag, idx) => (
                                        <Badge key={idx} className="text-xs bg-white/10">
                                          {tag}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-2 ml-4 flex-shrink-0">
                                <a href={file.file_url} target="_blank" rel="noopener noreferrer">
                                  <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                </a>
                                <a href={file.file_url} download>
                                  <Button variant="ghost" size="icon" className="text-gray-400 hover:text-green-400">
                                    <Download className="w-4 h-4" />
                                  </Button>
                                </a>
                                {canDelete && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDelete(file)}
                                    className="text-gray-400 hover:text-red-400"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
