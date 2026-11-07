'use client';

import { useState } from 'react';
import { useCustomers, useAddCustomer, useUpdateCustomer, useDeleteCustomer, useCustomerTransactions, useAddDuePayment } from '@/hooks/use-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Users, Search, Phone, MapPin, FileText, DollarSign, Receipt } from 'lucide-react';
import type { Customer, CustomerFormData } from '@/types';
import { format } from 'date-fns';

export function CustomersView() {
  const { data: customers = [], isLoading } = useCustomers();
  const addCustomer = useAddCustomer();
  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();
  const addDuePayment = useAddDuePayment();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentAmount, setPaymentAmount] = useState(0);

  const [formData, setFormData] = useState<CustomerFormData>({
    name: '',
    phone: '',
    address: '',
    notes: ''
  });

  const handleFormChange = (field: keyof CustomerFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      address: '',
      notes: ''
    });
  };

  const handleAddCustomer = async () => {
    if (!formData.name) {
      toast.error('Please enter customer name');
      return;
    }

    try {
      await addCustomer.mutateAsync(formData);
      toast.success('Customer added successfully');
      setIsAddDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error('Failed to add customer');
    }
  };

  const handleEditCustomer = async () => {
    if (!selectedCustomer || !formData.name) {
      toast.error('Please enter customer name');
      return;
    }

    try {
      await updateCustomer.mutateAsync({
        id: selectedCustomer.id,
        updates: formData
      });
      toast.success('Customer updated successfully');
      setIsEditDialogOpen(false);
      setSelectedCustomer(null);
      resetForm();
    } catch (error) {
      toast.error('Failed to update customer');
    }
  };

  const handleDeleteCustomer = async () => {
    if (!selectedCustomer) return;

    try {
      await deleteCustomer.mutateAsync(selectedCustomer.id);
      toast.success('Customer deleted successfully');
      setIsDeleteDialogOpen(false);
      setSelectedCustomer(null);
    } catch (error) {
      toast.error('Failed to delete customer');
    }
  };

  const handlePayment = async () => {
    if (!selectedCustomer || paymentAmount <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }

    try {
      await addDuePayment.mutateAsync({
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        amount: paymentAmount
      });
      toast.success('Payment recorded successfully');
      setIsPaymentDialogOpen(false);
      setPaymentAmount(0);
      setSelectedCustomer(null);
    } catch (error) {
      toast.error('Failed to record payment');
    }
  };

  const openEditDialog = (customer: Customer) => {
    setSelectedCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone,
      address: customer.address,
      notes: customer.notes
    });
    setIsEditDialogOpen(true);
  };

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.phone.includes(searchQuery)
  );

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading customers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Customers</h1>
          <p className="text-muted-foreground">Manage your customers and dues</p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Customer
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search customers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{customers.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Customers with Due</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-600">
              {customers.filter(c => c.totalDue > 0).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Due Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-600">
              ${customers.reduce((sum, c) => sum + c.totalDue, 0).toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Customers List */}
      {filteredCustomers.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredCustomers.map((customer) => (
            <Card key={customer.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => {
              setSelectedCustomer(customer);
              setIsDetailDialogOpen(true);
            }}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{customer.name}</CardTitle>
                    {customer.totalDue > 0 && (
                      <Badge variant="secondary" className="mt-1 bg-orange-100 text-orange-700">
                        Due: ${customer.totalDue.toFixed(2)}
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => openEditDialog(customer)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => {
                        setSelectedCustomer(customer);
                        setIsDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {customer.phone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      <span>{customer.phone}</span>
                    </div>
                  )}
                  {customer.address && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span className="truncate">{customer.address}</span>
                    </div>
                  )}
                  {customer.notes && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <FileText className="h-4 w-4" />
                      <span className="truncate">{customer.notes}</span>
                    </div>
                  )}
                </div>
                {customer.totalDue > 0 && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-3 w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedCustomer(customer);
                      setPaymentAmount(customer.totalDue);
                      setIsPaymentDialogOpen(true);
                    }}
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    Record Payment
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Users className="h-16 w-16 mb-4 opacity-50" />
          <p className="text-lg font-medium">No customers found</p>
          <p className="text-sm">Add your first customer to get started</p>
          <Button className="mt-4" onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Customer
          </Button>
        </div>
      )}

      {/* Add Customer Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
            <DialogDescription>
              Enter customer details below
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleFormChange('name', e.target.value)}
                placeholder="Enter customer name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => handleFormChange('phone', e.target.value)}
                placeholder="Enter phone number"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => handleFormChange('address', e.target.value)}
                placeholder="Enter address"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleFormChange('notes', e.target.value)}
                placeholder="Additional notes"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddCustomer} disabled={addCustomer.isPending}>
              {addCustomer.isPending ? 'Adding...' : 'Add Customer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Customer Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
            <DialogDescription>
              Update customer details below
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => handleFormChange('name', e.target.value)}
                placeholder="Enter customer name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                value={formData.phone}
                onChange={(e) => handleFormChange('phone', e.target.value)}
                placeholder="Enter phone number"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-address">Address</Label>
              <Input
                id="edit-address"
                value={formData.address}
                onChange={(e) => handleFormChange('address', e.target.value)}
                placeholder="Enter address"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                value={formData.notes}
                onChange={(e) => handleFormChange('notes', e.target.value)}
                placeholder="Additional notes"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditCustomer} disabled={updateCustomer.isPending}>
              {updateCustomer.isPending ? 'Updating...' : 'Update Customer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{selectedCustomer?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCustomer} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Customer Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedCustomer?.name}</DialogTitle>
            <DialogDescription>Customer details and purchase history</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
            <TabsContent value="details" className="space-y-4">
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Phone</Label>
                    <p>{selectedCustomer?.phone || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Total Due</Label>
                    <p className={selectedCustomer?.totalDue && selectedCustomer.totalDue > 0 ? 'text-orange-600 font-bold' : ''}>
                      ${selectedCustomer?.totalDue?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Address</Label>
                  <p>{selectedCustomer?.address || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Notes</Label>
                  <p>{selectedCustomer?.notes || '-'}</p>
                </div>
                <div className="text-sm text-muted-foreground">
                  Created: {selectedCustomer?.createdAt && format(new Date(selectedCustomer.createdAt), 'MMM dd, yyyy HH:mm')}
                </div>
              </div>
            </TabsContent>
            <TabsContent value="history">
              <CustomerTransactionHistory customerId={selectedCustomer?.id || ''} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Record a due payment for {selectedCustomer?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="text-sm text-muted-foreground">
              Current Due: <span className="font-bold text-orange-600">${selectedCustomer?.totalDue?.toFixed(2)}</span>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="paymentAmount">Payment Amount ($)</Label>
              <Input
                id="paymentAmount"
                type="number"
                step="0.01"
                min="0"
                max={selectedCustomer?.totalDue || 0}
                value={paymentAmount || ''}
                onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handlePayment} disabled={addDuePayment.isPending}>
              {addDuePayment.isPending ? 'Recording...' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Customer Transaction History Component
function CustomerTransactionHistory({ customerId }: { customerId: string }) {
  const { data: transactions = [], isLoading } = useCustomerTransactions(customerId);

  if (isLoading) {
    return <div className="py-8 text-center text-muted-foreground">Loading...</div>;
  }

  if (transactions.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <Receipt className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>No transactions found</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[300px]">
      <div className="space-y-2">
        {transactions.map((transaction) => (
          <div key={transaction.id} className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <p className="font-medium">${transaction.totalAmount.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">
                {transaction.items.length} items • {transaction.paymentMethod.toUpperCase()}
              </p>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              {format(new Date(transaction.createdAt), 'MMM dd, yyyy HH:mm')}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
