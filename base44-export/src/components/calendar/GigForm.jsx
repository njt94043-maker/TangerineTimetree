
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Save } from "lucide-react";

export default function GigForm({ gig, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(gig || {
    title: '',
    date: '',
    time: '',
    venue: '',
    address: '',
    type: 'gig',
    fee: '',
    notes: '',
    status: 'confirmed',
    visible_to_public: false
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      fee: formData.fee ? parseFloat(formData.fee) : undefined
    });
  };

  return (
    <Card className="bg-white/5 backdrop-blur-sm border-green-500/20 mb-6">
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          {gig ? 'Edit Gig' : 'Add New Gig'}
          <Button variant="ghost" size="icon" onClick={onCancel} className="text-gray-400">
            <X className="w-5 h-5" />
          </Button>
        </CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-gray-300">Gig Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                required
                className="bg-white/5 border-white/10 text-white"
                placeholder="e.g., Live at The Crown"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type" className="text-gray-300">Type</Label>
              <Select value={formData.type} onValueChange={(value) => setFormData({...formData, type: value})}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gig">Gig</SelectItem>
                  <SelectItem value="rehearsal">Rehearsal</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date" className="text-gray-300">Date *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({...formData, date: e.target.value})}
                required
                className="bg-white/5 border-white/10 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="time" className="text-gray-300">Time</Label>
              <Input
                id="time"
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({...formData, time: e.target.value})}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="venue" className="text-gray-300">Venue *</Label>
              <Input
                id="venue"
                value={formData.venue}
                onChange={(e) => setFormData({...formData, venue: e.target.value})}
                required
                className="bg-white/5 border-white/10 text-white"
                placeholder="Venue name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fee" className="text-gray-300">Fee (£)</Label>
              <Input
                id="fee"
                type="number"
                step="0.01"
                value={formData.fee}
                onChange={(e) => setFormData({...formData, fee: e.target.value})}
                className="bg-white/5 border-white/10 text-white"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address" className="text-gray-300">Address</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({...formData, address: e.target.value})}
              className="bg-white/5 border-white/10 text-white"
              placeholder="Full venue address"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status" className="text-gray-300">Status</Label>
            <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value})}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes" className="text-gray-300">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              className="bg-white/5 border-white/10 text-white h-24"
              placeholder="Additional details..."
            />
          </div>

          <div className="flex items-center gap-3 p-4 bg-green-500/10 rounded-lg border border-green-500/20">
            <input
              type="checkbox"
              id="visible_to_public"
              checked={formData.visible_to_public === true}
              onChange={(e) => setFormData({...formData, visible_to_public: e.target.checked})}
              className="w-5 h-5 rounded border-white/20 text-green-600 focus:ring-green-500"
            />
            <Label htmlFor="visible_to_public" className="text-gray-300 cursor-pointer flex-1">
              <span className="font-semibold">Display on Public Homepage</span>
              <p className="text-sm text-gray-400 mt-1">When checked, this gig will appear in the "Upcoming Gigs" section for fans</p>
            </Label>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel} className="border-white/10">
            Cancel
          </Button>
          <Button type="submit" className="bg-gradient-to-r from-green-500 to-green-600">
            <Save className="w-4 h-4 mr-2" />
            {gig ? 'Update' : 'Create'} Gig
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
