
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format, isAfter, isBefore } from "date-fns";
import { Calendar, User, Pencil, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function AvailabilityList({ unavailability, editingUnavailability, onEdit, onDelete, onSubmitEdit, onCancelEdit, isSubmitting }) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [unavailabilityToDelete, setUnavailabilityToDelete] = useState(null);

  const today = new Date();
  const currentUnavailability = unavailability.filter(item => 
    isAfter(new Date(item.end_date), today)
  );
  const pastUnavailability = unavailability.filter(item => 
    isBefore(new Date(item.end_date), today)
  );

  const handleDeleteClick = (item) => {
    setUnavailabilityToDelete(item);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (unavailabilityToDelete) {
      onDelete(unavailabilityToDelete.id);
    }
    setDeleteDialogOpen(false);
    setUnavailabilityToDelete(null);
  };

  return (
    <>
      <div className="space-y-6">
        {/* Current/Future Unavailability */}
        <Card className="bg-white/5 backdrop-blur-sm border-orange-500/20">
          <CardHeader>
            <CardTitle className="text-white">Current & Upcoming</CardTitle>
          </CardHeader>
          <CardContent>
            {currentUnavailability.length === 0 ? (
              <p className="text-gray-400 text-center py-8">All members currently available!</p>
            ) : (
              <div className="space-y-3">
                {currentUnavailability.map(item => (
                  <div key={item.id} className="p-4 bg-white/5 rounded-lg border border-white/10">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <User className="w-5 h-5 text-orange-400" />
                          <h4 className="font-semibold text-white text-lg">{item.member_name}</h4>
                        </div>
                        <div className="flex items-center gap-2 text-gray-400 mb-2">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {format(new Date(item.start_date), 'MMM d, yyyy')} - {format(new Date(item.end_date), 'MMM d, yyyy')}
                          </span>
                        </div>
                        {item.member_email && (
                          <p className="text-xs text-gray-500 mt-1">{item.member_email}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(item)}
                          className="text-gray-400 hover:text-white min-h-[44px] min-w-[44px]"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteClick(item)}
                          className="text-red-400 hover:text-red-300 min-h-[44px] min-w-[44px]"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Past Unavailability */}
        {pastUnavailability.length > 0 && (
          <Card className="bg-white/5 backdrop-blur-sm border-gray-500/20">
            <CardHeader>
              <CardTitle className="text-white">Past Unavailability</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 opacity-60">
                {pastUnavailability.map(item => (
                  <div key={item.id} className="p-4 bg-white/5 rounded-lg border border-white/10">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <User className="w-5 h-5 text-gray-400" />
                          <h4 className="font-semibold text-white">{item.member_name}</h4>
                        </div>
                        <div className="flex items-center gap-2 text-gray-400 text-sm">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {format(new Date(item.start_date), 'MMM d, yyyy')} - {format(new Date(item.end_date), 'MMM d, yyyy')}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteClick(item)}
                        className="text-red-400 hover:text-red-300 min-h-[44px] min-w-[44px]"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-gray-900 border-red-500/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Unavailability?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Are you sure you want to delete the unavailability for{' '}
              <strong className="text-white">{unavailabilityToDelete?.member_name}</strong> from{' '}
              <strong className="text-white">
                {unavailabilityToDelete && format(new Date(unavailabilityToDelete.start_date), 'MMM d')} - {unavailabilityToDelete && format(new Date(unavailabilityToDelete.end_date), 'MMM d, yyyy')}
              </strong>?
              <br /><br />
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/10 text-white hover:bg-white/10">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
