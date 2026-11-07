'use client';

import { useState } from 'react';
import { useProducts, useCategories, useAddProduct, useUpdateProduct, useDeleteProduct, useAddCategory } from '@/hooks/use-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Package, Search, AlertTriangle, Tag } from 'lucide-react';
import type { Product, ProductFormData } from '@/types';
import { format } from 'date-fns';

const defaultUnits = ['pcs', 'kg', 'g', 'liter', 'ml', 'pack', 'box', 'bottle'];

export function ProductsView() {
  const { data: products = [], isLoading } = useProducts();
  const { data: categories = [] } = useCategories();
  const addProduct = useAddProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const addCategory = useAddCategory();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [newCategoryName, setNewCategoryName] = useState('');

  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    category: '',
    buyPrice: 0,
    sellPrice: 0,
    quantity: 0,
    unit: 'pcs',
    minStock: 10
  });

  const handleFormChange = (field: keyof ProductFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category: '',
      buyPrice: 0,
      sellPrice: 0,
      quantity: 0,
      unit: 'pcs',
      minStock: 10
    });
  };

  const handleAddProduct = async () => {
    if (!formData.name || !formData.category) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      await addProduct.mutateAsync(formData);
      toast.success('Product added successfully');
      setIsAddDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error('Failed to add product');
    }
  };

  const handleEditProduct = async () => {
    if (!selectedProduct || !formData.name || !formData.category) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      await updateProduct.mutateAsync({
        id: selectedProduct.id,
        updates: formData
      });
      toast.success('Product updated successfully');
      setIsEditDialogOpen(false);
      setSelectedProduct(null);
      resetForm();
    } catch (error) {
      toast.error('Failed to update product');
    }
  };

  const handleDeleteProduct = async () => {
    if (!selectedProduct) return;

    try {
      await deleteProduct.mutateAsync(selectedProduct.id);
      toast.success('Product deleted successfully');
      setIsDeleteDialogOpen(false);
      setSelectedProduct(null);
    } catch (error) {
      toast.error('Failed to delete product');
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error('Please enter a category name');
      return;
    }

    try {
      await addCategory.mutateAsync(newCategoryName.trim());
      toast.success('Category added successfully');
      setNewCategoryName('');
      setIsCategoryDialogOpen(false);
    } catch (error) {
      toast.error('Failed to add category');
    }
  };

  const openEditDialog = (product: Product) => {
    setSelectedProduct(product);
    setFormData({
      name: product.name,
      category: product.category,
      buyPrice: product.buyPrice,
      sellPrice: product.sellPrice,
      quantity: product.quantity,
      unit: product.unit,
      minStock: product.minStock
    });
    setIsEditDialogOpen(true);
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const uniqueCategories = [...new Set(products.map(p => p.category))];

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading products...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Products</h1>
          <p className="text-muted-foreground">Manage your inventory</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsCategoryDialogOpen(true)}>
            <Tag className="h-4 w-4 mr-2" />
            Categories
          </Button>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {uniqueCategories.map(category => (
              <SelectItem key={category} value={category}>{category}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Products Grid */}
      {filteredProducts.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map((product) => (
            <Card key={product.id} className={product.quantity <= product.minStock ? 'border-orange-300' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{product.name}</CardTitle>
                    <CardDescription>{product.category}</CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => openEditDialog(product)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => {
                        setSelectedProduct(product);
                        setIsDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Buy Price:</span>
                    <span className="font-medium">${product.buyPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Sell Price:</span>
                    <span className="font-medium text-green-600">${product.sellPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Profit:</span>
                    <span className="font-medium text-green-600">
                      ${((product.sellPrice - product.buyPrice) / product.buyPrice * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Stock:</span>
                    {product.quantity <= product.minStock ? (
                      <Badge variant="destructive" className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {product.quantity} {product.unit}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        {product.quantity} {product.unit}
                      </Badge>
                    )}
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Min Stock:</span>
                    <span>{product.minStock} {product.unit}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Package className="h-16 w-16 mb-4 opacity-50" />
          <p className="text-lg font-medium">No products found</p>
          <p className="text-sm">Add your first product to get started</p>
          <Button className="mt-4" onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        </div>
      )}

      {/* Add Product Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Product</DialogTitle>
            <DialogDescription>
              Fill in the product details below
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Product Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleFormChange('name', e.target.value)}
                placeholder="Enter product name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category">Category *</Label>
              <Select value={formData.category} onValueChange={(v) => handleFormChange('category', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueCategories.map(category => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                  {categories.filter(c => !uniqueCategories.includes(c.name)).map(category => (
                    <SelectItem key={category.id} value={category.name}>{category.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="buyPrice">Buy Price ($) *</Label>
                <Input
                  id="buyPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.buyPrice || ''}
                  onChange={(e) => handleFormChange('buyPrice', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sellPrice">Sell Price ($) *</Label>
                <Input
                  id="sellPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.sellPrice || ''}
                  onChange={(e) => handleFormChange('sellPrice', parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="quantity">Quantity *</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="0"
                  value={formData.quantity || ''}
                  onChange={(e) => handleFormChange('quantity', parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="unit">Unit *</Label>
                <Select value={formData.unit} onValueChange={(v) => handleFormChange('unit', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {defaultUnits.map(unit => (
                      <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="minStock">Min Stock *</Label>
                <Input
                  id="minStock"
                  type="number"
                  min="0"
                  value={formData.minStock || ''}
                  onChange={(e) => handleFormChange('minStock', parseInt(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddProduct} disabled={addProduct.isPending}>
              {addProduct.isPending ? 'Adding...' : 'Add Product'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Product Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>
              Update the product details below
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Product Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => handleFormChange('name', e.target.value)}
                placeholder="Enter product name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-category">Category *</Label>
              <Select value={formData.category} onValueChange={(v) => handleFormChange('category', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueCategories.map(category => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-buyPrice">Buy Price ($) *</Label>
                <Input
                  id="edit-buyPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.buyPrice || ''}
                  onChange={(e) => handleFormChange('buyPrice', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-sellPrice">Sell Price ($) *</Label>
                <Input
                  id="edit-sellPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.sellPrice || ''}
                  onChange={(e) => handleFormChange('sellPrice', parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-quantity">Quantity *</Label>
                <Input
                  id="edit-quantity"
                  type="number"
                  min="0"
                  value={formData.quantity || ''}
                  onChange={(e) => handleFormChange('quantity', parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-unit">Unit *</Label>
                <Select value={formData.unit} onValueChange={(v) => handleFormChange('unit', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {defaultUnits.map(unit => (
                      <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-minStock">Min Stock *</Label>
                <Input
                  id="edit-minStock"
                  type="number"
                  min="0"
                  value={formData.minStock || ''}
                  onChange={(e) => handleFormChange('minStock', parseInt(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditProduct} disabled={updateProduct.isPending}>
              {updateProduct.isPending ? 'Updating...' : 'Update Product'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{selectedProduct?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProduct} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Category Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Categories</DialogTitle>
            <DialogDescription>
              Add new product categories
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex gap-2">
              <Input
                placeholder="New category name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
              />
              <Button onClick={handleAddCategory} disabled={addCategory.isPending}>
                Add
              </Button>
            </div>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {uniqueCategories.map(category => (
                  <div key={category} className="flex items-center justify-between p-2 rounded-lg border">
                    <span>{category}</span>
                    <Badge variant="secondary">
                      {products.filter(p => p.category === category).length} products
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
