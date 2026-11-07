'use client';

import { useState, useMemo } from 'react';
import { useProducts, useCustomers, useAddTransaction } from '@/hooks/use-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { ShoppingCart, Plus, Minus, Trash2, Search, User, Receipt } from 'lucide-react';
import type { Product } from '@/types';
import { useAppStore } from '@/store';

interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  buyPrice: number;
  unit: string;
  availableStock: number;
}

export function SaleView() {
  const { data: products = [] } = useProducts();
  const { data: customers = [] } = useCustomers();
  const addTransaction = useAddTransaction();
  const { setCurrentView } = useAppStore();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'due'>('cash');
  const [productSearch, setProductSearch] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const availableProducts = products.filter(p => p.quantity > 0);

  const filteredProducts = useMemo(() => {
    if (!productSearch) return availableProducts;
    return availableProducts.filter(p =>
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.category.toLowerCase().includes(productSearch.toLowerCase())
    );
  }, [availableProducts, productSearch]);

  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.productId === product.id);
    if (existing) {
      if (existing.quantity >= product.quantity) {
        toast.error('Not enough stock');
        return;
      }
      setCart(cart.map(item =>
        item.productId === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPrice: product.sellPrice,
        buyPrice: product.buyPrice,
        unit: product.unit,
        availableStock: product.quantity
      }]);
    }
  };

  const updateQuantity = (productId: string, change: number) => {
    const item = cart.find(i => i.productId === productId);
    if (!item) return;

    const newQuantity = item.quantity + change;
    if (newQuantity <= 0) {
      removeFromCart(productId);
    } else if (newQuantity > item.availableStock) {
      toast.error('Not enough stock');
    } else {
      setCart(cart.map(i =>
        i.productId === productId
          ? { ...i, quantity: newQuantity }
          : i
      ));
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.productId !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setSelectedCustomer('');
    setPaymentMethod('cash');
  };

  const totalAmount = cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const totalProfit = cart.reduce((sum, item) => sum + item.quantity * (item.unitPrice - item.buyPrice), 0);

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error('Please add items to cart');
      return;
    }

    if (paymentMethod === 'due' && !selectedCustomer) {
      toast.error('Please select a customer for due payment');
      return;
    }

    setIsProcessing(true);
    try {
      const customer = customers.find(c => c.id === selectedCustomer);
      await addTransaction.mutateAsync({
        items: cart.map(item => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          buyPrice: item.buyPrice,
          totalPrice: item.quantity * item.unitPrice
        })),
        customerId: selectedCustomer || undefined,
        customerName: customer?.name,
        totalAmount,
        paymentMethod,
        profit: totalProfit
      });

      toast.success('Transaction completed successfully!');
      clearCart();
      setCurrentView('transactions');
    } catch (error) {
      toast.error('Failed to complete transaction');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-6 h-[calc(100vh-2rem)]">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">New Sale</h1>
        <p className="text-muted-foreground">Create a new transaction</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100%-5rem)]">
        {/* Product Selection */}
        <div className="lg:col-span-2 flex flex-col">
          <Card className="flex-1 flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Select Products</CardTitle>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
              <ScrollArea className="h-[calc(100vh-22rem)]">
                <div className="grid gap-2 p-4 pt-0">
                  {filteredProducts.length > 0 ? (
                    filteredProducts.map((product) => {
                      const inCart = cart.find(item => item.productId === product.id);
                      return (
                        <div
                          key={product.id}
                          className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-accent transition-colors ${
                            inCart ? 'border-primary bg-primary/5' : ''
                          }`}
                          onClick={() => addToCart(product)}
                        >
                          <div className="flex-1">
                            <p className="font-medium">{product.name}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span>{product.category}</span>
                              <span>•</span>
                              <span>${product.sellPrice.toFixed(2)}/{product.unit}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant={product.quantity <= product.minStock ? 'destructive' : 'secondary'}>
                              {product.quantity} {product.unit}
                            </Badge>
                            {inCart && (
                              <Badge variant="default" className="bg-primary">
                                {inCart.quantity} in cart
                              </Badge>
                            )}
                            <Button size="sm" variant="ghost" onClick={(e) => {
                              e.stopPropagation();
                              addToCart(product);
                            }}>
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No products available</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Cart */}
        <div className="flex flex-col">
          <Card className="flex-1 flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Cart</CardTitle>
                {cart.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearCart}>
                    Clear
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
              <ScrollArea className="h-[200px]">
                {cart.length > 0 ? (
                  <div className="space-y-2 p-4 pt-0">
                    {cart.map((item) => (
                      <div key={item.productId} className="flex items-center justify-between p-2 rounded-lg border">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.productName}</p>
                          <p className="text-sm text-muted-foreground">
                            ${item.unitPrice.toFixed(2)} × {item.quantity}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => updateQuantity(item.productId, -1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => updateQuantity(item.productId, 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => removeFromCart(item.productId)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                    <ShoppingCart className="h-12 w-12 mb-2 opacity-50" />
                    <p>Cart is empty</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
            <Separator />
            <CardFooter className="flex-col gap-4 p-4">
              {/* Customer Selection */}
              <div className="w-full">
                <Label className="text-sm text-muted-foreground">Customer (Optional)</Label>
                <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Walk-in customer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Walk-in customer</SelectItem>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                        {customer.totalDue > 0 && ` (Due: $${customer.totalDue.toFixed(2)})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Payment Method */}
              <div className="w-full">
                <Label className="text-sm text-muted-foreground">Payment Method</Label>
                <RadioGroup
                  value={paymentMethod}
                  onValueChange={(v) => setPaymentMethod(v as 'cash' | 'due')}
                  className="flex gap-4 mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="cash" id="cash" />
                    <Label htmlFor="cash" className="cursor-pointer">Cash</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="due" id="due" />
                    <Label htmlFor="due" className="cursor-pointer">Due (Credit)</Label>
                  </div>
                </RadioGroup>
                {paymentMethod === 'due' && !selectedCustomer && (
                  <p className="text-sm text-destructive mt-1">Please select a customer for due payment</p>
                )}
              </div>

              {/* Totals */}
              <div className="w-full space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span>${totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Profit:</span>
                  <span className="text-green-600">${totalProfit.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span>${totalAmount.toFixed(2)}</span>
                </div>
              </div>

              {/* Checkout Button */}
              <Button
                className="w-full"
                size="lg"
                onClick={handleCheckout}
                disabled={cart.length === 0 || isProcessing || (paymentMethod === 'due' && !selectedCustomer)}
              >
                <Receipt className="h-4 w-4 mr-2" />
                {isProcessing ? 'Processing...' : 'Complete Sale'}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
