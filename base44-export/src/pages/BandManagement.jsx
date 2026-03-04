
import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Users, Edit2, Save, X, Mail, User, Music } from "lucide-react";
import { toast } from "sonner";

import SessionPaymentTracker from "../components/expenses/SessionPaymentTracker";
import DeepTestAnalyzer from "../components/bookings/DeepTestAnalyzer";
import RetroactiveRecordGenerator from "../components/bookings/RetroactiveRecordGenerator";
import RegenerateMissingPDFs from "../components/bookings/RegenerateMissingPDFs";

export default function BandManagement() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({});

  // Removed auth check - app is now public

  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => base44.entities.User.list(),
    initialData: [],
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, data }) => {
      await base44.entities.User.update(userId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      setEditingUser(null);
      setEditForm({});
      toast.success('User updated successfully!');
    },
    onError: () => {
      toast.error('Failed to update user');
    }
  });

  const startEdit = (user) => {
    setEditingUser(user.id);
    setEditForm({
      full_name: user.full_name || '',
      band_role: user.band_role || ''
    });
  };

  const cancelEdit = () => {
    setEditingUser(null);
    setEditForm({});
  };

  const saveEdit = (userId) => {
    updateUserMutation.mutate({ userId, data: editForm });
  };

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Band Management</h1>
          <p className="text-gray-400">Manage band member information</p>
        </div>

        <div className="space-y-6 mb-8">
          <RegenerateMissingPDFs />
          <DeepTestAnalyzer />
          <RetroactiveRecordGenerator />
          <SessionPaymentTracker />
        </div>

        <Card className="bg-white/5 backdrop-blur-sm border-green-500/20">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-green-400" />
              Band Members ({allUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {allUsers.map((user) => (
                <div key={user.id} className="bg-white/5 rounded-lg p-4 border border-white/10">
                  {editingUser === user.id ? (
                    // Edit Mode
                    <div className="space-y-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-gray-300">Full Name *</Label>
                          <Input
                            value={editForm.full_name}
                            onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                            className="bg-white/5 border-white/10 text-white"
                            placeholder="Enter full name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-gray-300">Band Role</Label>
                          <Input
                            value={editForm.band_role}
                            onChange={(e) => setEditForm({ ...editForm, band_role: e.target.value })}
                            className="bg-white/5 border-white/10 text-white"
                            placeholder="e.g., Lead Guitar and Backing Vocals"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-3">
                        <Button
                          variant="outline"
                          onClick={cancelEdit}
                          className="border-white/10"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Cancel
                        </Button>
                        <Button
                          onClick={() => saveEdit(user.id)}
                          disabled={updateUserMutation.isPending}
                          className="bg-gradient-to-r from-green-500 to-green-600"
                        >
                          <Save className="w-4 h-4 mr-2" />
                          Save Changes
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        {user.profile_picture_url ? (
                          <img
                            src={user.profile_picture_url}
                            alt={user.full_name}
                            className="w-16 h-16 rounded-full object-cover border-2 border-green-500/50"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500/20 to-orange-500/20 flex items-center justify-center border-2 border-white/10">
                            <User className="w-8 h-8 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-xl font-semibold text-white">
                              {user.full_name || 'No name set'}
                            </h3>
                            <Badge className={user.role === 'admin' ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'}>
                              {user.role === 'admin' ? 'Admin' : 'Member'}
                            </Badge>
                            {user.is_band_manager && (
                              <Badge className="bg-purple-500/20 text-purple-400">
                                Band Manager
                              </Badge>
                            )}
                          </div>
                          <div className="space-y-1 text-sm text-gray-400">
                            <div className="flex items-center gap-2">
                              <Mail className="w-4 h-4" />
                              {user.email}
                            </div>
                            {user.band_role && (
                              <div className="flex items-center gap-2">
                                <Music className="w-4 h-4" />
                                {user.band_role}
                              </div>
                            )}
                            {user.address_line1 && (
                              <div className="text-xs text-gray-500 mt-2">
                                📍 {user.address_line1}, {user.city}, {user.postcode}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startEdit(user)}
                        className="border-white/10 text-gray-300 hover:text-white"
                      >
                        <Edit2 className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
