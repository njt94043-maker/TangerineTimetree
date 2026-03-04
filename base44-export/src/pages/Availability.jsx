
import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";
import AvailabilityList from "../components/availability/AvailabilityList";
import AvailabilityForm from "../components/availability/AvailabilityForm";
import QuickAvailabilityInput from "../components/availability/QuickAvailabilityInput";

export default function Availability() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [showQuickInput, setShowQuickInput] = useState(false);
  const [editingUnavailability, setEditingUnavailability] = useState(null);

  // Removed auth check - app is now public
  // The original useEffect for authentication has been removed as per the instructions.

  const { data: unavailability = [] } = useQuery({
    queryKey: ['unavailability'],
    queryFn: () => base44.entities.Unavailability.list('-start_date'),
    initialData: [],
  });

  const createUnavailabilityMutation = useMutation({
    mutationFn: (data) => base44.entities.Unavailability.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unavailability'] });
      setShowForm(false);
      setEditingUnavailability(null);
    },
  });

  const updateUnavailabilityMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Unavailability.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unavailability'] });
      setShowForm(false);
      setEditingUnavailability(null);
    },
  });

  const deleteUnavailabilityMutation = useMutation({
    mutationFn: (id) => base44.entities.Unavailability.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unavailability'] });
    },
  });

  const handleSubmit = (data) => {
    if (editingUnavailability) {
      updateUnavailabilityMutation.mutate({ id: editingUnavailability.id, data });
    } else {
      createUnavailabilityMutation.mutate(data);
    }
  };

  const handleEdit = (item) => {
    setEditingUnavailability(item);
    setShowForm(true);
    setShowQuickInput(false);
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this unavailability record?')) {
      deleteUnavailabilityMutation.mutate(id);
    }
  };

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Member Availability</h1>
            <p className="text-gray-400">Track when band members are unavailable</p>
          </div>
          <div className="flex gap-3">
            {!showQuickInput && !showForm && (
              <Button
                onClick={() => setShowQuickInput(true)}
                className="bg-gradient-to-r from-orange-500 to-purple-500 hover:from-orange-600 hover:to-purple-600"
              >
                <Zap className="w-5 h-5 mr-2" />
                Quick Add
              </Button>
            )}
            <Button
              onClick={() => {
                setEditingUnavailability(null);
                setShowForm(true);
                setShowQuickInput(false);
              }}
              className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Unavailability
            </Button>
          </div>
        </div>

        {/* Quick Input */}
        {showQuickInput && !showForm && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <QuickAvailabilityInput onClose={() => setShowQuickInput(false)} />
          </motion.div>
        )}

        {showForm && (
          <AvailabilityForm
            unavailability={editingUnavailability}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingUnavailability(null);
            }}
          />
        )}

        <AvailabilityList
          unavailability={unavailability}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </div>
    </div>
  );
}
