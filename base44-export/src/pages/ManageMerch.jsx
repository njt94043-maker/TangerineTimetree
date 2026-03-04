
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Upload, Loader2, Edit, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import AutoSyncManager from "../components/merch/AutoSyncManager";
import InkThreadableSettings from "../components/merch/InkThreadableSettings";

export default function ManageMerch() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [sortBy, setSortBy] = useState('order');

  // Removed auth check - app is now public

  const { data: allMerchItems = [], isLoading } = useQuery({
    queryKey: ['merch-admin'],
    queryFn: () => base44.entities.Merchandise.list('order'),
    initialData: [],
  });

  // Sort products
  const merchItems = [...allMerchItems].sort((a, b) => {
    if (sortBy === 'order') return (a.order || 0) - (b.order || 0);
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'price') return a.price - b.price;
    if (sortBy === 'newest') {
      const dateA = new Date(b.created_date || 0);
      const dateB = new Date(a.created_date || 0);
      return dateA.getTime() - dateB.getTime();
    }
    return 0;
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Merchandise.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merch-admin'] });
      queryClient.invalidateQueries({ queryKey: ['merch'] });
      setShowForm(false);
      setEditingProduct(null);
      toast.success('Product added successfully!');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Merchandise.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merch-admin'] });
      queryClient.invalidateQueries({ queryKey: ['merch'] });
      setShowForm(false);
      setEditingProduct(null);
      toast.success('Product updated successfully!');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Merchandise.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merch-admin'] });
      queryClient.invalidateQueries({ queryKey: ['merch'] });
      toast.success('Product deleted successfully!');
    },
  });

  const moveProduct = async (product, direction) => {
    const currentIndex = merchItems.findIndex(p => p.id === product.id);
    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    
    if (swapIndex < 0 || swapIndex >= merchItems.length) return;
    
    const swapProduct = merchItems[swapIndex];
    
    // Perform a temporary swap of order values
    const newOrderForProduct = swapProduct.order;
    const newOrderForSwapProduct = product.order;

    try {
      // Update both products in a batch or sequentially
      await base44.entities.Merchandise.update(product.id, { order: newOrderForProduct });
      await base44.entities.Merchandise.update(swapProduct.id, { order: newOrderForSwapProduct });
      
      queryClient.invalidateQueries({ queryKey: ['merch-admin'] });
      toast.success('Product order updated!');
    } catch (error) {
      toast.error('Failed to update product order.');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    const data = {
      name: formData.get('name'),
      description: formData.get('description'),
      price: parseFloat(formData.get('price')),
      image_url: formData.get('image_url'),
      purchase_url: formData.get('purchase_url'),
      sizes: formData.get('sizes'),
      order: parseInt(formData.get('order')),
      featured: formData.get('featured') === 'on',
      available: formData.get('available') === 'on',
    };

    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleImageUpload = async (file) => {
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      document.getElementById('image_url').value = file_url;
      toast.success('Image uploaded!');
    } catch (error) {
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = (item) => {
    setEditingProduct(item);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      deleteMutation.mutate(id);
    }
  };

  // Calculate next order based on all Merch items, not just the sorted view
  const nextOrder = allMerchItems.length > 0 ? Math.max(...allMerchItems.map(m => m.order || 0)) + 1 : 1;

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Manage Merchandise</h1>
            <p className="text-gray-400">Connect to InkThreadable API for automatic syncing</p>
          </div>
          <Button
            onClick={() => {
              setEditingProduct(null);
              setShowForm(!showForm);
            }}
            className="bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700"
          >
            <Plus className="w-5 h-5 mr-2" />
            {showForm ? 'Cancel' : 'Add Manually'}
          </Button>
        </div>

        {/* InkThreadable API Settings - NEW */}
        <InkThreadableSettings />

        {/* Auto Sync Manager */}
        <AutoSyncManager />

        {/* Sort Controls */}
        {!showForm && merchItems.length > 0 && (
          <Card className="bg-white/5 backdrop-blur-sm border-white/10 mb-6">
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <Label className="text-gray-300">Sort by:</Label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="order">Display Order</SelectItem>
                    <SelectItem value="name">Name (A-Z)</SelectItem>
                    <SelectItem value="price">Price (Low-High)</SelectItem>
                    <SelectItem value="newest">Newest First</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-gray-400 text-sm ml-auto">
                  {merchItems.length} product{merchItems.length !== 1 ? 's' : ''}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Manual Form */}
        {showForm && (
          <Card className="bg-white/5 backdrop-blur-sm border-pink-500/20 mb-8">
            <CardHeader>
              <CardTitle className="text-white">
                {editingProduct ? 'Edit Product' : 'Add Product Manually'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name" className="text-gray-300">Product Name *</Label>
                  <Input
                    id="name"
                    name="name"
                    defaultValue={editingProduct?.name}
                    required
                    placeholder="e.g., Band T-Shirt"
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>

                <div>
                  <Label htmlFor="description" className="text-gray-300">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    defaultValue={editingProduct?.description}
                    placeholder="Product description"
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="price" className="text-gray-300">Price (£) *</Label>
                    <Input
                      id="price"
                      name="price"
                      type="number"
                      step="0.01"
                      defaultValue={editingProduct?.price}
                      required
                      placeholder="19.99"
                      className="bg-white/5 border-white/10 text-white"
                    />
                  </div>

                  <div>
                    <Label htmlFor="sizes" className="text-gray-300">Available Sizes</Label>
                    <Input
                      id="sizes"
                      name="sizes"
                      defaultValue={editingProduct?.sizes}
                      placeholder="S, M, L, XL"
                      className="bg-white/5 border-white/10 text-white"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="image_url" className="text-gray-300">Product Image URL *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="image_url"
                      name="image_url"
                      defaultValue={editingProduct?.image_url}
                      required
                      placeholder="https://..."
                      className="bg-white/5 border-white/10 text-white flex-1"
                    />
                    <div className="relative">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => e.target.files[0] && handleImageUpload(e.target.files[0])}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        disabled={uploading}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        disabled={uploading}
                        className="border-pink-500/50 text-pink-400"
                      >
                        {uploading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="purchase_url" className="text-gray-300">InkThreadable Product URL *</Label>
                  <Input
                    id="purchase_url"
                    name="purchase_url"
                    defaultValue={editingProduct?.purchase_url}
                    required
                    placeholder="https://www.inkthreadable.co.uk/..."
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>

                <div>
                  <Label htmlFor="order" className="text-gray-300">Display Order *</Label>
                  <Input
                    id="order"
                    name="order"
                    type="number"
                    defaultValue={editingProduct?.order || nextOrder}
                    required
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>

                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="featured"
                      name="featured"
                      defaultChecked={editingProduct?.featured}
                    />
                    <Label htmlFor="featured" className="text-gray-300">Featured Product</Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      id="available"
                      name="available"
                      defaultChecked={editingProduct?.available !== false}
                    />
                    <Label htmlFor="available" className="text-gray-300">Available for Purchase</Label>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700"
                  >
                    {editingProduct ? 'Update Product' : 'Add Product'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowForm(false);
                      setEditingProduct(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Product Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-pink-500 animate-spin" />
          </div>
        ) : merchItems.length === 0 ? (
          <Card className="bg-white/5 backdrop-blur-sm border-white/10">
            <CardContent className="py-20 text-center">
              <p className="text-gray-400 text-lg mb-2">No products yet</p>
              <p className="text-gray-500 text-sm">Use auto-sync or add products manually</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {merchItems.map((item, index) => (
              <Card key={item.id} className="bg-white/5 backdrop-blur-sm border-white/10 overflow-hidden">
                <div className="aspect-square relative">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-pink-500/20 to-purple-500/20 flex items-center justify-center">
                      <Upload className="w-20 h-20 text-white/30" />
                    </div>
                  )}
                  {item.featured && (
                    <div className="absolute top-2 left-2">
                      <span className="bg-orange-500 text-white text-xs px-2 py-1 rounded">Featured</span>
                    </div>
                  )}
                  {!item.available && (
                    <div className="absolute top-2 right-2">
                      <span className="bg-red-500 text-white text-xs px-2 py-1 rounded">Unavailable</span>
                    </div>
                  )}
                  {sortBy === 'order' && (
                    <div className="absolute top-2 right-2 flex gap-1">
                      {index > 0 && (
                        <Button
                          size="icon"
                          variant="secondary"
                          className="h-6 w-6 bg-white/90"
                          onClick={() => moveProduct(item, 'up')}
                        >
                          <ArrowUp className="w-3 h-3" />
                        </Button>
                      )}
                      {index < merchItems.length - 1 && (
                        <Button
                          size="icon"
                          variant="secondary"
                          className="h-6 w-6 bg-white/90"
                          onClick={() => moveProduct(item, 'down')}
                        >
                          <ArrowDown className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                <CardContent className="p-4">
                  <h3 className="text-white font-bold text-lg mb-1">{item.name}</h3>
                  <p className="text-gray-400 text-sm mb-2 line-clamp-2">{item.description}</p>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-green-400 font-bold text-xl">£{item.price.toFixed(2)}</span>
                    {item.sizes && (
                      <span className="text-gray-400 text-sm">{item.sizes}</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleEdit(item)}
                      variant="outline"
                      size="sm"
                      className="flex-1 border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      onClick={() => handleDelete(item.id)}
                      variant="outline"
                      size="sm"
                      className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/10"
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card className="bg-blue-500/10 border-blue-500/20 mt-8">
          <CardContent className="py-4">
            <h3 className="text-blue-300 font-semibold mb-2">📦 InkThreadable Integration Guide</h3>
            <ul className="text-sm text-gray-400 space-y-1 list-disc ml-4">
              <li>Create your designs on <a href="https://www.inkthreadable.co.uk/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">InkThreadable.co.uk</a></li>
              <li>Copy the product image URL and paste it in "Product Image URL"</li>
              <li>Copy the product purchase link and paste it in "InkThreadable Product URL"</li>
              <li>Set your retail price and available sizes</li>
              <li>Toggle "Featured" to highlight special products</li>
              <li>Products will appear on your public merch shop page</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
