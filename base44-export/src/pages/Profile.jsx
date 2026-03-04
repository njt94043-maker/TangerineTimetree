
import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
// Removed import for useNavigate as it's no longer used for redirects
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { User, Mail, Save, Loader2, Upload, Camera, MapPin, Users } from "lucide-react";
import { toast } from "sonner";
// Removed import for AddressInput

export default function Profile() {
  // Removed useNavigate as it's no longer used for authentication redirects
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    band_role: '',
    profile_picture_url: '',
    address_line1: '',
    address_line2: '',
    city: '',
    postcode: '',
    is_band_manager: false,
  });

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
        setFormData({
          full_name: userData.full_name || '',
          band_role: userData.band_role || '',
          profile_picture_url: userData.profile_picture_url || '',
          address_line1: userData.address_line1 || '',
          address_line2: userData.address_line2 || '',
          city: userData.city || '',
          postcode: userData.postcode || '',
          is_band_manager: userData.is_band_manager || false,
        });
      } catch (error) {
        // If not authenticated or any other error, set user to null
        // and initialize formData with empty values, making the page public
        // without redirecting to login.
        setUser(null);
        setFormData({
          full_name: '',
          band_role: '',
          profile_picture_url: '',
          address_line1: '',
          address_line2: '',
          city: '',
          postcode: '',
          is_band_manager: false,
        });
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image is too large. Maximum size is 5MB.');
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file.');
      return;
    }

    setUploading(true);

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, profile_picture_url: file_url });
      toast.success('Profile picture uploaded!');
    } catch (error) {
      toast.error('Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      // If user is null, this operation will likely fail on the backend
      // for not being authenticated. The frontend allows the attempt.
      await base44.auth.updateMe(formData);
      
      const updatedUser = await base44.auth.me();
      setUser(updatedUser);
      
      toast.success('Profile updated successfully!');
    } catch (error) {
      toast.error('Failed to update profile. You might need to log in.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">My Profile</h1>
          <p className="text-gray-400">Manage your account information</p>
        </div>

        <Card className="bg-white/5 backdrop-blur-sm border-green-500/20">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <User className="w-5 h-5 text-green-400" />
              Profile Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Profile Picture */}
              <div className="space-y-2">
                <Label className="text-gray-300">Profile Picture</Label>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    {formData.profile_picture_url ? (
                      <img
                        src={formData.profile_picture_url}
                        alt="Profile"
                        className="w-24 h-24 rounded-full object-cover border-2 border-green-500/50"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-green-500/20 to-orange-500/20 flex items-center justify-center border-2 border-white/10">
                        <User className="w-12 h-12 text-gray-400" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => document.getElementById('profile-picture').click()}
                      disabled={uploading}
                      className="absolute bottom-0 right-0 bg-green-500 hover:bg-green-600 text-white rounded-full p-2 transition-colors"
                    >
                      {uploading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Camera className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <div className="flex-1">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('profile-picture').click()}
                      disabled={uploading}
                      className="border-white/10"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          {formData.profile_picture_url ? 'Change Picture' : 'Upload Picture'}
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-gray-500 mt-2">Recommended: Square image, max 5MB</p>
                  </div>
                </div>
                <input
                  id="profile-picture"
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {/* Email (read-only) */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-300 flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={user?.email || ''} // Handle case where user is null
                  disabled
                  className="bg-white/5 border-white/10 text-gray-400 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500">Email cannot be changed</p>
              </div>

              {/* Full Name */}
              <div className="space-y-2">
                <Label htmlFor="full_name" className="text-gray-300">
                  Full Name *
                </Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required
                  className="bg-white/5 border-white/10 text-white"
                  placeholder="Enter your full name"
                />
              </div>

              {/* Band Role */}
              <div className="space-y-2">
                <Label htmlFor="band_role" className="text-gray-300">
                  Role in Band
                </Label>
                <Input
                  id="band_role"
                  value={formData.band_role}
                  onChange={(e) => setFormData({ ...formData, band_role: e.target.value })}
                  className="bg-white/5 border-white/10 text-white"
                  placeholder="e.g., Lead Guitar and Backing Vocals"
                />
                <p className="text-xs text-gray-500">
                  Examples: Lead Guitar and Backing Vocals, Lead Vocals, Bass, Drums
                </p>
              </div>

              {/* Band Manager Toggle - Only for Admin */}
              {user?.role === 'admin' && ( // Handle case where user is null
                <div className="space-y-2 pt-4 border-t border-white/10">
                  <Label className="text-gray-300 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Band Management Role
                  </Label>
                  <div className="flex items-center gap-3 p-4 bg-white/5 rounded-lg">
                    <input
                      type="checkbox"
                      id="is_band_manager"
                      checked={formData.is_band_manager || false}
                      onChange={(e) => setFormData({ ...formData, is_band_manager: e.target.checked })}
                      className="w-5 h-5 rounded border-white/10 text-green-500 focus:ring-green-500"
                    />
                    <div className="flex-1">
                      <label htmlFor="is_band_manager" className="text-white font-medium cursor-pointer">
                        I am the appointed band manager/contractor
                      </label>
                      <p className="text-xs text-gray-400 mt-1">
                        As band manager, you'll handle invoicing, pay session musicians, and manage band business taxes
                      </p>
                    </div>
                  </div>
                  {formData.is_band_manager && (
                    <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 mt-2">
                      <p className="text-sm text-orange-300">
                        ⚠️ <strong>Important:</strong> You'll need to complete TWO tax returns:
                      </p>
                      <ul className="text-xs text-gray-400 mt-2 ml-4 space-y-1">
                        <li>• <strong>Personal:</strong> Your session musician income (1/4 share)</li>
                        <li>• <strong>Business:</strong> Band income minus session payments to all 4 musicians</li>
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Address Section */}
              <div className="space-y-4 pt-4 border-t border-white/10">
                <div className="flex items-center gap-2 text-gray-300 mb-4">
                  <MapPin className="w-4 h-4" />
                  <Label className="text-gray-300 font-semibold">Home Address</Label>
                </div>
                <p className="text-xs text-gray-500 mb-4">Used for calculating mileage to gigs and practices</p>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="address_line1" className="text-gray-300">Street Address *</Label>
                    <Input
                      id="address_line1"
                      value={formData.address_line1}
                      onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                      className="bg-white/5 border-white/10 text-white h-12 text-base"
                      placeholder="e.g., 123 High Street"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address_line2" className="text-gray-300">Address Line 2 (Optional)</Label>
                    <Input
                      id="address_line2"
                      value={formData.address_line2}
                      onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
                      className="bg-white/5 border-white/10 text-white h-12 text-base"
                      placeholder="Apartment, suite, etc."
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city" className="text-gray-300">City *</Label>
                      <Input
                        id="city"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        className="bg-white/5 border-white/10 text-white h-12 text-base"
                        placeholder="e.g., Cardiff"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="postcode" className="text-gray-300">Postcode *</Label>
                      <Input
                        id="postcode"
                        value={formData.postcode}
                        onChange={(e) => setFormData({ ...formData, postcode: e.target.value.toUpperCase() })}
                        className="bg-white/5 border-white/10 text-white h-12 text-base"
                        placeholder="e.g., CF10 1AA"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Role Badge */}
              <div className="space-y-2">
                <Label className="text-gray-300">Account Role</Label>
                <div className="flex items-center gap-2">
                  {user ? ( // Only render if user object exists
                    <>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        user.role === 'admin' 
                          ? 'bg-orange-500/20 text-orange-400' 
                          : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {user.role === 'admin' ? 'Admin' : 'Band Member'}
                      </span>
                      {user.role === 'admin' && (
                        <span className="text-xs text-gray-500">Full access to all features</span>
                      )}
                    </>
                  ) : (
                    <span className="text-sm text-gray-500">No account loaded.</span>
                  )}
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-4">
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Removed Logout Button: as the page is now public, there's no concept of logging out from here */}
      </div>
    </div>
  );
}
