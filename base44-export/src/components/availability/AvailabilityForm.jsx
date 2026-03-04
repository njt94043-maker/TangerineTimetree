import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { X, Save, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export default function AvailabilityForm({ unavailability, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(unavailability || {
    member_name: '',
    member_email: '',
    start_date: '',
    end_date: ''
  });

  const [suggestions, setSuggestions] = useState({
    members: [],
    emails: {}
  });

  const [autoFillSuggestion, setAutoFillSuggestion] = useState(null);

  // Fetch all unavailability records to learn from
  const { data: allUnavailability = [] } = useQuery({
    queryKey: ['unavailability-for-learning'],
    queryFn: () => base44.entities.Unavailability.list('-start_date'),
    initialData: [],
  });

  // Build suggestions from historical data
  useEffect(() => {
    const memberData = {};

    allUnavailability.forEach(record => {
      if (record.member_name) {
        if (!memberData[record.member_name]) {
          memberData[record.member_name] = {
            emails: []
          };
        }
        if (record.member_email) memberData[record.member_name].emails.push(record.member_email);
      }
    });

    const newSuggestions = {
      members: Object.keys(memberData),
      emails: Object.entries(memberData).reduce((acc, [name, data]) => {
        acc[name] = data.emails[0] || '';
        return acc;
      }, {})
    };

    setSuggestions(newSuggestions);
  }, [allUnavailability]);

  // Auto-fill email when member name is selected
  useEffect(() => {
    if (formData.member_name && !unavailability) {
      const memberRecords = allUnavailability.filter(r => 
        r.member_name.toLowerCase() === formData.member_name.toLowerCase()
      );

      if (memberRecords.length > 0) {
        const latestRecord = memberRecords[0];
        
        const suggestion = {
          member_email: latestRecord.member_email || ''
        };

        setAutoFillSuggestion(suggestion);

        // Auto-fill if fields are empty
        setFormData(prev => ({
          ...prev,
          member_email: prev.member_email || suggestion.member_email
        }));
      }
    }
  }, [formData.member_name, allUnavailability, unavailability]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Card className="bg-white/5 backdrop-blur-sm border-orange-500/20 mb-6">
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            {unavailability ? 'Edit Unavailability' : 'Add Unavailability'}
            {autoFillSuggestion && !unavailability && (
              <span className="text-xs text-green-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Smart auto-fill active
              </span>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onCancel} className="text-gray-400">
            <X className="w-5 h-5" />
          </Button>
        </CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="member_name" className="text-gray-300">Member Name *</Label>
              <Input
                id="member_name"
                list="member-suggestions"
                value={formData.member_name}
                onChange={(e) => setFormData({...formData, member_name: e.target.value})}
                required
                className="bg-white/5 border-white/10 text-white"
                placeholder="Band member name"
              />
              <datalist id="member-suggestions">
                {suggestions.members.map((member, idx) => (
                  <option key={idx} value={member} />
                ))}
              </datalist>
            </div>

            <div className="space-y-2">
              <Label htmlFor="member_email" className="text-gray-300">Member Email</Label>
              <Input
                id="member_email"
                type="email"
                value={formData.member_email}
                onChange={(e) => setFormData({...formData, member_email: e.target.value})}
                className="bg-white/5 border-white/10 text-white"
                placeholder="email@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="start_date" className="text-gray-300">Start Date *</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                required
                className="bg-white/5 border-white/10 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_date" className="text-gray-300">End Date *</Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                required
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
          </div>

          {autoFillSuggestion && !unavailability && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-sm text-green-400">
              <Sparkles className="w-4 h-4 inline mr-2" />
              Smart suggestions applied based on {allUnavailability.filter(r => r.member_name.toLowerCase() === formData.member_name.toLowerCase()).length} previous records for {formData.member_name}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel} className="border-white/10">
            Cancel
          </Button>
          <Button type="submit" className="bg-gradient-to-r from-orange-500 to-orange-600">
            <Save className="w-4 h-4 mr-2" />
            {unavailability ? 'Update' : 'Add'} Unavailability
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}