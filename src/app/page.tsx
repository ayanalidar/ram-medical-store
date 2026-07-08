'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'
import { BarChart3, Pill, ShoppingCart, Package, Users, FileText, AlertTriangle, Plus, Search, TrendingUp, CalendarDays, Clock, DollarSign, Upload, RefreshCw, Trash2, Edit, Eye, X, ArrowRight, CheckCircle, XCircle, FileDown, ChevronRight, Activity, Archive, ClipboardList, LogOut, UserPlus, UserCog, Lock, Menu, BookOpen, Truck, Phone, MapPin, Send } from 'lucide-react'

type Page = 'dashboard' | 'billing' | 'inventory' | 'purchases' | 'suppliers' | 'reports' | 'expiry' | 'import' | 'substitutes' | 'catalog' | 'users'

interface CurrentUser {
  id: string; name: string; username: string; role: string; phone: string | null
}

interface UserRecord {
  id: string; name: string; username: string; role: string; phone: string | null; active: boolean; createdAt: string
}

// Types
interface Medicine {
  id: string; name: string; genericName: string | null; brandName: string | null; categoryId: string;
  category: Category; manufacturer: string | null; description: string | null; dosageForm: string | null;
  strength: string | null; unit: string; reorderLevel: number; reorderQty: number; taxRate: number;
  hsnCode: string | null; rackLocation: string | null; batches: Batch[]
}

interface Category { id: string; name: string; description: string | null; _count?: { medicines: number } }

interface Batch {
  id: string; medicineId: string; batchNo: string; expiryDate: string; purchasePrice: number;
  sellingPrice: number; mrp: number | null; quantity: number; minQuantity: number;
  supplierId: string | null; supplier?: Supplier; purchaseDate: string | null
}

interface Supplier {
  id: string; name: string; phone: string; email: string | null; address: string | null;
  gstNumber: string | null; contactPerson: string | null; balance: number; _count?: { purchaseOrders: number }
}

interface Sale {
  id: string; invoiceNo: string; customerName: string | null; customerPhone: string | null;
  doctorName: string | null; prescription: string | null; subtotal: number; discount: number;
  tax: number; total: number; paymentMethod: string; status: string; date: string;
  items: SaleItem[]
}

interface SaleItem {
  id: string; saleId: string; medicineId: string; batchId: string | null; medicineName: string | null;
  quantity: number; unitPrice: number; discount: number; tax: number; total: number
}

interface PurchaseOrder {
  id: string; orderNo: string; supplierId: string; supplier?: Supplier; date: string;
  expectedDate: string | null; totalAmount: number; status: string; notes: string | null;
  items: PurchaseOrderItem[]
}

interface PurchaseOrderItem {
  id: string; purchaseOrderId: string; medicineId: string; medicineName: string | null;
  batchNo: string | null; quantity: number; unitPrice: number; total: number; receivedQty: number
}

interface CartItem {
  medicine: Medicine; quantity: number; unitPrice: number; batch?: Batch
}

interface DashboardData {
  stats: { totalMedicines: number; totalCategories: number; totalSuppliers: number;
    todaySales: { total: number; count: number }; weekSales: { total: number; count: number };
    monthSales: { total: number; count: number }; lowStockCount: number; expiringCount: number;
    expiredCount: number; pendingOrders: number }
  lowStockItems: { id: string; name: string; genericName: string | null; stock: number; reorderLevel: number }[]
  recentSales: Sale[]
  monthlyData: { month: string; revenue: number; sales: number }[]
}

export default function Home() {
  const [activePage, setActivePage] = useState<Page>('dashboard')
  const { toast } = useToast()

  // Auth state
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [showLogin, setShowLogin] = useState(true)
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [setupDone, setSetupDone] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [forgotUsername, setForgotUsername] = useState('')
  const [forgotNewPassword, setForgotNewPassword] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotMsg, setForgotMsg] = useState('')
  const [showDefaultCreds, setShowDefaultCreds] = useState(false)

  // Auto-setup database + check saved session on load
  const runSetup = async () => {
    setSetupDone(false)
    try {
      const r = await fetch('/api/setup')
      const data = await r.json()
      setSetupDone(true)
      if (data.status === 'setup_complete') {
        toast({ title: 'Database initialized', description: `${data.medicines} medicines, ${data.suppliers} suppliers loaded` })
      }
      // Show default credentials only if admin password is still default
      if (data.defaultPasswordChanged === false) {
        setShowDefaultCreds(true)
      } else {
        setShowDefaultCreds(false)
      }
    } catch {
      setSetupDone(true)
    }
  }

  useEffect(() => {
    const savedUser = localStorage.getItem('ram_user')
    const savedToken = localStorage.getItem('ram_token')
    if (savedUser && savedToken) {
      try {
        const user = JSON.parse(savedUser)
        setCurrentUser(user)
        setSessionToken(savedToken)
        setShowLogin(false)
        setSetupDone(true)
        return
      } catch {
        localStorage.removeItem('ram_user')
        localStorage.removeItem('ram_token')
      }
    }

    // Always run setup to ensure admin user exists
    runSetup()
    // Also ensure admin user exists via login endpoint (faster, lighter)
    fetch('/api/auth/login').catch(() => {})
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      })
      const data = await res.json()

      if (data.success) {
        setCurrentUser(data.user)
        setSessionToken(data.token)
        localStorage.setItem('ram_user', JSON.stringify(data.user))
        localStorage.setItem('ram_token', data.token)
        setShowLogin(false)
        toast({ title: `Welcome, ${data.user.name}!`, description: `Logged in as ${data.user.role}` })
      } else {
        setLoginError(data.error || 'Login failed. Try clicking Setup Database below.')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setLoginError(`Network error: ${msg}. Try clicking Setup Database.`)
    } finally {
      setLoginLoading(false)
    }
  }

  const handleLogout = () => {
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    setCurrentUser(null)
    setSessionToken(null)
    localStorage.removeItem('ram_user')
    localStorage.removeItem('ram_token')
    setShowLogin(true)
    setLoginUsername('')
    setLoginPassword('')
  }

  // LOGIN PAGE
  if (showLogin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-28 h-28 rounded-2xl flex items-center justify-center mx-auto mb-4 overflow-hidden shadow-lg border-2 border-emerald-200">
              <img src="/logo-store.jpg" alt="RAM Medical Store" className="object-cover w-full h-full" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">RAM MEDICAL Store</h1>
            <p className="text-slate-500 mt-1">Billing & Inventory Management</p>
          </div>

          {!setupDone && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 text-center flex items-center justify-center gap-2">
              <div className="animate-spin w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full" />
              Setting up database for first time, please wait...
            </div>
          )}

          <Card className="shadow-xl border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-600" />
                Sign In
              </CardTitle>
              <CardDescription>Enter your credentials to access the store</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    placeholder="Enter username"
                    value={loginUsername}
                    onChange={e => setLoginUsername(e.target.value)}
                    className="mt-1"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter password"
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    className="mt-1"
                    required
                  />
                </div>
                {loginError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                    {loginError}
                  </div>
                )}
                <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={loginLoading || !setupDone}>
                  {loginLoading ? 'Signing in...' : 'Sign In'}
                </Button>
                <div className="flex items-center justify-center gap-4 mt-3">
                  <button type="button" onClick={() => setShowForgot(true)} className="text-sm text-emerald-600 hover:text-emerald-700 hover:underline">
                    Forgot Password?
                  </button>
                  <button type="button" onClick={runSetup} disabled={!setupDone} className="text-sm text-slate-500 hover:text-emerald-700 hover:underline">
                    Setup Database
                  </button>
                </div>
              </form>
              {showDefaultCreds && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                  <p className="font-semibold">Default Login (first time only):</p>
                  <p className="mt-1">Username: <strong>admin</strong> | Password: <strong>admin123</strong></p>
                  <p className="mt-1 text-blue-600">Change this immediately after first login from Users section.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <p className="text-center text-xs text-slate-500 mt-6">
            RAM Medical Store Management System
          </p>
          <p className="text-center text-xs text-emerald-600 font-semibold mt-1">
            Made & Maintained By GuardianX
          </p>

          {/* Forgot Password Dialog */}
          <Dialog open={showForgot} onOpenChange={setShowForgot}>
            <DialogContent className="max-w-md w-[calc(100%-2rem)]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-600" />
                  Reset Password
                </DialogTitle>
                <DialogDescription>Enter your username and set a new password</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Username</Label>
                  <Input
                    placeholder="Enter your username"
                    value={forgotUsername}
                    onChange={e => { setForgotUsername(e.target.value); setForgotMsg('') }}
                  />
                </div>
                <div>
                  <Label>New Password</Label>
                  <Input
                    type="password"
                    placeholder="Enter new password (min 4 chars)"
                    value={forgotNewPassword}
                    onChange={e => { setForgotNewPassword(e.target.value); setForgotMsg('') }}
                    minLength={4}
                  />
                </div>
                {forgotMsg && (
                  <div className={`p-3 rounded-lg text-sm ${forgotMsg.includes('success') ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                    {forgotMsg}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setShowForgot(false)}>Cancel</Button>
                  <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" disabled={forgotLoading || !forgotUsername || forgotNewPassword.length < 4} onClick={async () => {
                    setForgotLoading(true)
                    setForgotMsg('')
                    try {
                      const res = await fetch('/api/users', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username: forgotUsername, password: forgotNewPassword }),
                      })
                      const data = await res.json()
                      if (data.success) {
                        setForgotMsg('Password reset successfully! You can now login.')
                        setTimeout(() => { setShowForgot(false); setForgotUsername(''); setForgotNewPassword(''); setForgotMsg('') }, 2000)
                      } else {
                        setForgotMsg(data.error || 'Failed to reset password')
                      }
                    } catch {
                      setForgotMsg('Network error. Please try again.')
                    } finally { setForgotLoading(false) }
                  }}>
                    {forgotLoading ? 'Resetting...' : 'Reset Password'}
                  </Button>
                </div>
                <p className="text-xs text-slate-400 text-center">Contact your admin if you don't remember your username</p>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    )
  }

  const isAdmin = currentUser?.role === 'Admin'
  const navItems: { id: Page; label: string; icon: React.ReactNode; adminOnly?: boolean }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'billing', label: 'Billing / POS', icon: <ShoppingCart className="w-4 h-4" /> },
    { id: 'inventory', label: 'Inventory', icon: <Package className="w-4 h-4" /> },
    { id: 'purchases', label: 'Purchases', icon: <ClipboardList className="w-4 h-4" /> },
    { id: 'suppliers', label: 'Suppliers', icon: <Users className="w-4 h-4" /> },
    { id: 'reports', label: 'Reports', icon: <FileText className="w-4 h-4" /> },
    { id: 'expiry', label: 'Expiry Tracker', icon: <AlertTriangle className="w-4 h-4" /> },
    { id: 'substitutes', label: 'Substitutes', icon: <RefreshCw className="w-4 h-4" /> },
    { id: 'catalog', label: 'Catalog / Delivery', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'import', label: 'Import Data', icon: <Upload className="w-4 h-4" /> },
    { id: 'users', label: 'Users', icon: <UserCog className="w-4 h-4" />, adminOnly: true },
  ]

  const handleNavClick = (page: Page) => {
    setActivePage(page)
    setSidebarOpen(false)
  }

  // Sidebar content (shared between desktop and mobile)
  const sidebarContent = (
    <>
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden border border-emerald-500/50">
            <img src="/logo-store.jpg" alt="RAM Medical" className="object-cover w-full h-full" />
          </div>
          <div>
            <h1 className="font-bold text-sm">RAM MEDICAL</h1>
            <p className="text-xs text-slate-400">Store Management</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.filter(item => !item.adminOnly || isAdmin).map(item => (
          <button
            key={item.id}
            onClick={() => handleNavClick(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
              activePage === item.id
                ? 'bg-emerald-600 text-white shadow-lg'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>
      <div className="p-3 border-t border-slate-700 space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center text-xs font-bold">
            {currentUser?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{currentUser?.name}</p>
            <p className="text-xs text-slate-400">{currentUser?.role}</p>
          </div>
          <button onClick={handleLogout} className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors" title="Logout">
            <LogOut className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>
      <div className="p-3 border-t border-slate-700">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Activity className="w-3 h-3" />
          <span>System Online</span>
        </div>
      </div>
    </>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Mobile Sidebar Drawer */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white flex flex-col transform transition-transform duration-200 lg:hidden ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {sidebarContent}
      </aside>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 bg-slate-900 text-white flex-col shrink-0">
        {sidebarContent}
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Mobile Top Bar */}
        <div className="lg:hidden sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-slate-100">
              <Menu className="w-5 h-5 text-slate-700" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md flex items-center justify-center overflow-hidden border border-emerald-500/50">
                <img src="/logo-store.jpg" alt="RAM Medical" className="object-cover w-full h-full" />
              </div>
              <span className="font-bold text-sm text-slate-900">RAM MEDICAL</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 truncate max-w-[80px]">{currentUser?.name}</span>
            <button onClick={handleLogout} className="p-1.5 rounded-lg hover:bg-slate-100" title="Logout">
              <LogOut className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>

        <div className="lg:hidden h-px" />

        {activePage === 'dashboard' && <DashboardPage onNavigate={handleNavClick} />}
        {activePage === 'billing' && <BillingPage />}
        {activePage === 'inventory' && <InventoryPage />}
        {activePage === 'purchases' && <PurchasesPage />}
        {activePage === 'suppliers' && <SuppliersPage />}
        {activePage === 'reports' && <ReportsPage />}
        {activePage === 'expiry' && <ExpiryPage />}
        {activePage === 'substitutes' && <SubstitutesPage />}
        {activePage === 'catalog' && <CatalogPage />}
        {activePage === 'import' && <ImportPage />}
        {activePage === 'users' && isAdmin && <UsersPage currentUser={currentUser} />}
      </main>
    </div>
  )
}

// ==================== DASHBOARD ====================
function DashboardPage({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchDashboard() }, [])

  const fetchDashboard = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/dashboard')
      const json = await res.json()
      setData(json)
    } catch { /* silent */ } finally { setLoading(false) }
  }

  if (loading || !data) return <div className="p-8 flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" /></div>

  const s = data.stats

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-900">Dashboard</h2>
          <p className="text-slate-500 text-sm">RAM Medical Store Overview</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchDashboard}><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard title="Today's Sales" value={`₹${s.todaySales.total.toFixed(2)}`} subtitle={`${s.todaySales.count} txns`} icon={<DollarSign className="w-5 h-5" />} color="emerald" />
        <StatCard title="Medicines" value={s.totalMedicines} subtitle={`${s.totalCategories} cats`} icon={<Pill className="w-5 h-5" />} color="blue" />
        <StatCard title="Low Stock" value={s.lowStockCount} subtitle="Need reorder" icon={<AlertTriangle className="w-5 h-5" />} color="amber" />
        <StatCard title="Expiring" value={s.expiringCount + s.expiredCount} subtitle={`${s.expiredCount} expired`} icon={<Clock className="w-5 h-5" />} color="red" />
      </div>

      {/* Monthly Revenue + Low Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Monthly Revenue (Last 6 Months)</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.monthlyData.map((m, i) => (
                <div key={i} className="flex items-center gap-2 sm:gap-4">
                  <span className="text-xs sm:text-sm text-slate-500 w-16 sm:w-20 shrink-0">{m.month}</span>
                  <div className="flex-1 min-w-0">
                    <Progress value={Math.min(100, (m.revenue / (Math.max(...data.monthlyData.map(x => x.revenue)) || 1)) * 100)} className="h-3" />
                  </div>
                  <span className="text-xs sm:text-sm font-semibold w-16 sm:w-24 text-right shrink-0">₹{m.revenue.toFixed(0)}</span>
                  <Badge variant="secondary" className="hidden sm:flex w-16 justify-center">{m.sales} sales</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Low Stock Items</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('inventory')}>View All <ChevronRight className="w-3 h-3 ml-1" /></Button>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-72">
              <div className="space-y-3">
                {data.lowStockItems.slice(0, 8).map(item => (
                  <div key={item.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50">
                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-slate-500">{item.genericName || 'No generic name'}</p>
                    </div>
                    <Badge variant={item.stock <= 0 ? 'destructive' : 'secondary'}>{item.stock} left</Badge>
                  </div>
                ))}
                {data.lowStockItems.length === 0 && <p className="text-sm text-slate-400 text-center py-4">All items well stocked</p>}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Recent Sales */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent Sales</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => onNavigate('reports')}>View All <ChevronRight className="w-3 h-3 ml-1" /></Button>
        </CardHeader>
        <CardContent>
          <ScrollArea className="w-full">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Invoice</TableHead><TableHead>Customer</TableHead><TableHead className="hidden sm:table-cell">Items</TableHead><TableHead>Total</TableHead><TableHead className="hidden md:table-cell">Payment</TableHead><TableHead className="hidden md:table-cell">Date</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {data.recentSales.slice(0, 8).map(sale => (
                <TableRow key={sale.id}>
                  <TableCell className="font-mono text-xs sm:text-sm">{sale.invoiceNo}</TableCell>
                  <TableCell className="text-sm">{sale.customerName || 'Walk-in'}</TableCell>
                  <TableCell className="hidden sm:table-cell">{sale.items.length} items</TableCell>
                  <TableCell className="font-semibold text-sm">₹{sale.total.toFixed(2)}</TableCell>
                  <TableCell className="hidden md:table-cell"><Badge variant="outline">{sale.paymentMethod}</Badge></TableCell>
                  <TableCell className="text-slate-500 text-sm hidden md:table-cell">{new Date(sale.date).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
              {data.recentSales.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-slate-400 py-8">No sales yet. Start billing from the POS.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({ title, value, subtitle, icon, color }: { title: string; value: string | number; subtitle: string; icon: React.ReactNode; color: string }) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
  }
  const iconColors: Record<string, string> = {
    emerald: 'bg-emerald-500',
    blue: 'bg-blue-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
  }
  return (
    <Card className={`border ${colors[color] || ''}`}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium opacity-80">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            <p className="text-xs mt-1 opacity-60">{subtitle}</p>
          </div>
          <div className={`w-12 h-12 rounded-xl ${iconColors[color]} text-white flex items-center justify-center`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ==================== BILLING / POS ====================
function BillingPage() {
  const [cart, setCart] = useState<CartItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Medicine[]>([])
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [doctorName, setDoctorName] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [discount, setDiscount] = useState(0)
  const [showReceipt, setShowReceipt] = useState<Sale | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (searchQuery.length >= 2) {
      fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`)
        .then(r => r.json())
        .then(setSearchResults)
        .catch(() => {})
    } else { setSearchResults([]) }
  }, [searchQuery])

  const addToCart = (med: Medicine) => {
    const existing = cart.find(c => c.medicine.id === med.id)
    if (existing) {
      setCart(cart.map(c => c.medicine.id === med.id ? { ...c, quantity: c.quantity + 1 } : c))
    } else {
      const batch = med.batches.find(b => b.quantity > 0)
      setCart([...cart, { medicine: med, quantity: 1, unitPrice: batch?.sellingPrice || 0, batch }])
    }
    setSearchQuery('')
    setSearchResults([])
  }

  const updateQty = (id: string, qty: number) => {
    if (qty <= 0) setCart(cart.filter(c => c.medicine.id !== id))
    else setCart(cart.map(c => c.medicine.id === id ? { ...c, quantity: qty } : c))
  }

  const subtotal = cart.reduce((s, c) => s + c.unitPrice * c.quantity, 0)
  const taxTotal = cart.reduce((s, c) => s + (c.medicine.taxRate * c.unitPrice * c.quantity / 100), 0)
  const total = subtotal - discount + taxTotal

  const checkout = async () => {
    if (cart.length === 0) return toast({ title: 'Cart is empty', variant: 'destructive' })
    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map(c => ({
            medicineId: c.medicine.id,
            medicineName: c.medicine.name,
            quantity: c.quantity,
            unitPrice: c.unitPrice,
            discount: 0,
            tax: c.medicine.taxRate * c.unitPrice * c.quantity / 100,
          })),
          customerName: customerName || null,
          customerPhone: customerPhone || null,
          doctorName: doctorName || null,
          subtotal, discount, tax: taxTotal, total, paymentMethod,
        }),
      })
      const sale = await res.json()
      if (!res.ok) throw new Error(sale.error)
      setShowReceipt(sale)
      setCart([])
      setCustomerName('')
      setCustomerPhone('')
      setDoctorName('')
      setDiscount(0)
      toast({ title: 'Sale completed!', description: `Invoice: ${sale.invoiceNo}` })
    } catch (e: unknown) {
      toast({ title: 'Sale failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    }
  }

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-0">
      {/* Left: Search & Medicine List */}
      <div className="flex-1 flex flex-col p-3 sm:p-4 md:p-6 overflow-y-auto">
        <div className="flex items-center gap-4 mb-6">
          <h2 className="text-xl md:text-2xl font-bold text-slate-900">Billing / POS</h2>
          <Badge variant="secondary">{cart.length} items in cart</Badge>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Search medicines by name, generic name, brand..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 h-12 text-base" />
        </div>

        {searchResults.length > 0 && (
          <div className="bg-white rounded-lg border shadow-lg mb-4 max-h-96 overflow-y-auto">
            {searchResults.map(med => {
              const totalStock = med.batches.reduce((s, b) => s + b.quantity, 0)
              return (
                <button key={med.id} onClick={() => addToCart(med)} className="w-full flex items-center justify-between p-3 hover:bg-emerald-50 border-b last:border-0 text-left">
                  <div>
                    <p className="font-medium text-sm">{med.name}</p>
                    <p className="text-xs text-slate-500">{med.genericName || ''} {med.strength && `| ${med.strength}`} | {med.category.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">₹{med.batches.find(b => b.quantity > 0)?.sellingPrice || 'N/A'}</p>
                    <Badge variant={totalStock <= 5 ? 'destructive' : 'secondary'} className="text-xs">{totalStock} in stock</Badge>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Cart Items */}
        <Card className="flex-1 min-h-0">
          <CardHeader><CardTitle className="text-base">Cart Items</CardTitle></CardHeader>
          <CardContent>
            {cart.length === 0 ? (
              <p className="text-slate-400 text-center py-8">Search and add medicines to cart</p>
            ) : (
              <ScrollArea className="w-full"><Table>
                <TableHeader><TableRow><TableHead>Medicine</TableHead><TableHead className="hidden sm:table-cell">Price</TableHead><TableHead>Qty</TableHead><TableHead>Total</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {cart.map(item => (
                    <TableRow key={item.medicine.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{item.medicine.name}</p>
                          <p className="text-xs text-slate-500">{item.medicine.strength || ''} | {item.medicine.unit}</p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">₹{item.unitPrice.toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button size="icon" variant="outline" className="w-7 h-7" onClick={() => updateQty(item.medicine.id, item.quantity - 1)}>-</Button>
                          <Input value={item.quantity} onChange={e => updateQty(item.medicine.id, parseInt(e.target.value) || 0)} className="w-16 h-8 text-center" />
                          <Button size="icon" variant="outline" className="w-7 h-7" onClick={() => updateQty(item.medicine.id, item.quantity + 1)}>+</Button>
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold">₹{(item.unitPrice * item.quantity).toFixed(2)}</TableCell>
                      <TableCell><Button size="icon" variant="ghost" onClick={() => updateQty(item.medicine.id, 0)}><Trash2 className="w-4 h-4 text-red-500" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table></ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right: Customer & Payment */}
      <div className="lg:w-96 w-full bg-white lg:border-l border-t p-4 sm:p-6 flex flex-col shrink-0">
        <h3 className="font-semibold text-lg mb-4">Payment</h3>
        <div className="space-y-3">
          <div><Label className="text-xs">Customer Name</Label><Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Walk-in customer" /></div>
          <div><Label className="text-xs">Phone</Label><Input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="Optional" /></div>
          <div><Label className="text-xs">Doctor Name</Label><Input value={doctorName} onChange={e => setDoctorName(e.target.value)} placeholder="Prescribing doctor" /></div>
          <div><Label className="text-xs">Payment Method</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="Cash">Cash</SelectItem><SelectItem value="Card">Card</SelectItem><SelectItem value="UPI">UPI</SelectItem><SelectItem value="Credit">Credit</SelectItem></SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">Discount (₹)</Label><Input type="number" value={discount} onChange={e => setDiscount(parseFloat(e.target.value) || 0)} /></div>
        </div>

        <Separator className="my-4" />

        <div className="space-y-2 flex-1">
          <div className="flex justify-between text-sm"><span className="text-slate-500">Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-slate-500">Discount</span><span className="text-red-500">-₹{discount.toFixed(2)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-slate-500">Tax</span><span>₹{taxTotal.toFixed(2)}</span></div>
          <Separator />
          <div className="flex justify-between text-lg font-bold"><span>Total</span><span className="text-emerald-600">₹{total.toFixed(2)}</span></div>
        </div>

        <Button className="w-full h-12 mt-4 text-base" size="lg" onClick={checkout} disabled={cart.length === 0}>
          <CheckCircle className="w-5 h-5 mr-2" /> Complete Sale
        </Button>
      </div>

      {/* Receipt Dialog */}
      <Dialog open={!!showReceipt} onOpenChange={() => setShowReceipt(null)}>
        <DialogContent className="max-w-md w-[calc(100%-2rem)]">
          <DialogHeader><DialogTitle>Sale Completed</DialogTitle><DialogDescription>Invoice generated successfully</DialogDescription></DialogHeader>
          {showReceipt && (
            <div className="space-y-4">
              <div className="text-center border-b pb-4">
                <h3 className="font-bold text-lg">RAM MEDICAL STORE</h3>
                <p className="text-sm text-slate-500">Invoice: {showReceipt.invoiceNo}</p>
                <p className="text-xs text-slate-400">{new Date(showReceipt.date).toLocaleString()}</p>
              </div>
              <div className="text-sm space-y-1">
                <p>Customer: {showReceipt.customerName || 'Walk-in'}</p>
                <p>Payment: {showReceipt.paymentMethod}</p>
              </div>
              <ScrollArea className="w-full"><Table>
                <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Qty</TableHead><TableHead>Price</TableHead><TableHead>Total</TableHead></TableRow></TableHeader>
                <TableBody>
                  {showReceipt.items.map(item => (
                    <TableRow key={item.id}><TableCell className="text-sm">{item.medicineName}</TableCell><TableCell>{item.quantity}</TableCell><TableCell>₹{item.unitPrice.toFixed(2)}</TableCell><TableCell>₹{item.total.toFixed(2)}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table></ScrollArea>
              <div className="text-right space-y-1 border-t pt-2">
                <p className="text-sm">Subtotal: ₹{showReceipt.subtotal.toFixed(2)}</p>
                <p className="text-sm text-red-500">Discount: -₹{showReceipt.discount.toFixed(2)}</p>
                <p className="text-sm">Tax: ₹{showReceipt.tax.toFixed(2)}</p>
                <p className="text-lg font-bold text-emerald-600">Total: ₹{showReceipt.total.toFixed(2)}</p>
              </div>
            </div>
          )}
          <DialogFooter><Button onClick={() => setShowReceipt(null)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ==================== INVENTORY ====================
function InventoryPage() {
  const [medicines, setMedicines] = useState<Medicine[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCat, setSelectedCat] = useState('all')
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [showBatch, setShowBatch] = useState<Medicine | null>(null)
  const [editMed, setEditMed] = useState<Medicine | null>(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', genericName: '', brandName: '', categoryId: '', manufacturer: '', dosageForm: '', strength: '', unit: 'Strip', reorderLevel: 10, reorderQty: 50, taxRate: 0, rackLocation: '' })
  const [quickForm, setQuickForm] = useState({ name: '', genericName: '', batchNo: '', dosageForm: 'Tablet', strength: '', unit: 'Strip', rackLocation: '', reorderLevel: 10, reorderQty: 50, buyPrice: 0, sellPrice: 0, mrp: 0, quantity: 0, expiryDate: '', categoryId: '', manufacturer: '' })
  const [batchForm, setBatchForm] = useState({ batchNo: '', expiryDate: '', purchasePrice: 0, sellingPrice: 0, mrp: 0, quantity: 0, supplierId: '' })
  const [showAddCat, setShowAddCat] = useState(false)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickAddLoading, setQuickAddLoading] = useState(false)
  const [catForm, setCatForm] = useState({ name: '', description: '' })
  const dosageOptions = ['Tablet', 'Capsule', 'Syrup', 'Bottle', 'Strip', 'Sachet', 'Injection', 'Cream', 'Ointment', 'Gel', 'Drops', 'Spray', 'Inhaler', 'Powder', 'Lotion', 'Soap', 'Soap Bar', 'Tube', 'Patch', 'Suppository', 'Other']
  const { toast } = useToast()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [medsRes, catsRes] = await Promise.all([fetch('/api/medicines'), fetch('/api/categories')])
      setMedicines(await medsRes.json())
      setCategories(await catsRes.json())
    } catch { /* silent */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = medicines.filter(m => {
    if (selectedCat !== 'all' && m.categoryId !== selectedCat) return false
    if (search && !m.name.toLowerCase().includes(search.toLowerCase()) && !(m.genericName || '').toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const createMedicine = async () => {
    try {
      const res = await fetch('/api/medicines', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (!res.ok) throw new Error('Failed')
      toast({ title: 'Medicine added' })
      setShowAdd(false)
      setForm({ name: '', genericName: '', brandName: '', categoryId: '', manufacturer: '', dosageForm: '', strength: '', unit: 'Strip', reorderLevel: 10, reorderQty: 50, taxRate: 0, rackLocation: '' })
      fetchData()
    } catch { toast({ title: 'Failed to add medicine', variant: 'destructive' }) }
  }

  const updateMedicine = async () => {
    if (!editMed) return
    try {
      await fetch('/api/medicines', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editMed.id, ...form }) })
      toast({ title: 'Medicine updated' })
      setEditMed(null)
      fetchData()
    } catch { toast({ title: 'Failed', variant: 'destructive' }) }
  }

  const deleteMedicine = async (id: string) => {
    try {
      await fetch(`/api/medicines?id=${id}`, { method: 'DELETE' })
      toast({ title: 'Medicine deleted' })
      fetchData()
    } catch { toast({ title: 'Failed', variant: 'destructive' }) }
  }

  const addBatch = async () => {
    if (!showBatch) return
    try {
      const res = await fetch('/api/batches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...batchForm, medicineId: showBatch.id }) })
      if (!res.ok) throw new Error('Failed')
      toast({ title: 'Batch added' })
      setBatchForm({ batchNo: '', expiryDate: '', purchasePrice: 0, sellingPrice: 0, mrp: 0, quantity: 0, supplierId: '' })
      fetchData()
      const updated = await fetch(`/api/medicines?id=${showBatch.id}`).then(r => r.json())
      setShowBatch(updated)
    } catch { toast({ title: 'Failed to add batch', variant: 'destructive' }) }
  }

  const openEdit = (med: Medicine) => {
    setEditMed(med)
    setForm({ name: med.name, genericName: med.genericName || '', brandName: med.brandName || '', categoryId: med.categoryId, manufacturer: med.manufacturer || '', dosageForm: med.dosageForm || '', strength: med.strength || '', unit: med.unit, reorderLevel: med.reorderLevel, reorderQty: med.reorderQty, taxRate: med.taxRate, rackLocation: med.rackLocation || '' })
  }

  const createCategory = async () => {
    try {
      await fetch('/api/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(catForm) })
      toast({ title: 'Category added' })
      setShowAddCat(false)
      setCatForm({ name: '', description: '' })
      fetchData()
    } catch { toast({ title: 'Failed', variant: 'destructive' }) }
  }

  const quickAddStock = async () => {
    if (!quickForm.name || !quickForm.batchNo || !quickForm.expiryDate || quickForm.quantity <= 0) {
      toast({ title: 'Please fill: Medicine name, Batch No, Expiry Date, Quantity', variant: 'destructive' })
      return
    }
    setQuickAddLoading(true)
    try {
      // Create medicine
      const medRes = await fetch('/api/medicines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: quickForm.name,
          genericName: quickForm.genericName,
          brandName: '',
          categoryId: quickForm.categoryId || undefined,
          manufacturer: quickForm.manufacturer,
          dosageForm: quickForm.dosageForm,
          strength: quickForm.strength,
          unit: quickForm.unit,
          reorderLevel: quickForm.reorderLevel,
          reorderQty: quickForm.reorderQty,
          taxRate: 0,
          rackLocation: quickForm.rackLocation,
        }),
      })
      if (!medRes.ok) throw new Error('Medicine create failed')
      const med = await medRes.json()

      // Create batch with pricing
      await fetch('/api/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          medicineId: med.id,
          batchNo: quickForm.batchNo,
          expiryDate: quickForm.expiryDate,
          purchasePrice: quickForm.buyPrice,
          sellingPrice: quickForm.sellPrice,
          mrp: quickForm.mrp,
          quantity: quickForm.quantity,
        }),
      })

      toast({ title: 'Stock added successfully!', description: `${quickForm.name} - ${quickForm.quantity} ${quickForm.unit}` })
      setShowQuickAdd(false)
      setQuickForm({ name: '', genericName: '', batchNo: '', dosageForm: 'Tablet', strength: '', unit: 'Strip', rackLocation: '', reorderLevel: 10, reorderQty: 50, buyPrice: 0, sellPrice: 0, mrp: 0, quantity: 0, expiryDate: '', categoryId: '', manufacturer: '' })
      fetchData()
    } catch (e) {
      toast({ title: 'Failed to add stock', description: String(e), variant: 'destructive' })
    } finally { setQuickAddLoading(false) }
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-xl md:text-2xl font-bold text-slate-900">Inventory Management</h2>
        <div className="flex gap-2">
          <Dialog open={showAddCat} onOpenChange={setShowAddCat}>
            <DialogTrigger asChild><Button variant="outline"><Plus className="w-4 h-4 mr-1" /> Add Category</Button></DialogTrigger>
            <DialogContent className="max-w-md w-[calc(100%-2rem)]">
              <DialogHeader><DialogTitle>Add Category</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Name</Label><Input value={catForm.name} onChange={e => setCatForm({ ...catForm, name: e.target.value })} /></div>
                <div><Label>Description</Label><Input value={catForm.description} onChange={e => setCatForm({ ...catForm, description: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={createCategory}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={showQuickAdd} onOpenChange={setShowQuickAdd}>
            <DialogTrigger asChild><Button className="bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4 mr-1" /> Add Stock</Button></DialogTrigger>
            <DialogContent className="max-w-lg w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="flex items-center gap-2"><Package className="w-5 h-5 text-emerald-600" /> Add Stock - Medicine + Batch</DialogTitle><DialogDescription>Fill in the details to add a new medicine with stock</DialogDescription></DialogHeader>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="col-span-1 sm:col-span-2"><Label>Medicine Name *</Label><Input placeholder="e.g. Paracetamol 500mg" value={quickForm.name} onChange={e => setQuickForm({ ...quickForm, name: e.target.value })} /></div>
                <div><Label>Generic Name</Label><Input placeholder="e.g. Paracetamol" value={quickForm.genericName} onChange={e => setQuickForm({ ...quickForm, genericName: e.target.value })} /></div>
                <div><Label>Batch No *</Label><Input placeholder="e.g. PCM-2025-001" value={quickForm.batchNo} onChange={e => setQuickForm({ ...quickForm, batchNo: e.target.value })} /></div>
                <div>
                  <Label>Dosage Form *</Label>
                  <Select value={quickForm.dosageForm} onValueChange={v => setQuickForm({ ...quickForm, dosageForm: v, unit: v === 'Syrup' || v === 'Bottle' || v === 'Drops' || v === 'Lotion' || v === 'Spray' || v === 'Cream' || v === 'Gel' || v === 'Ointment' || v === 'Powder' || v === 'Soap' || v === 'Soap Bar' ? 'Bottle' : v === 'Sachet' ? 'Sachet' : v === 'Injection' ? 'Vial' : v === 'Tube' ? 'Tube' : 'Strip' })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{dosageOptions.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Strength</Label><Input placeholder="e.g. 500mg, 10ml" value={quickForm.strength} onChange={e => setQuickForm({ ...quickForm, strength: e.target.value })} /></div>
                <div><Label>Unit</Label><Input value={quickForm.unit} onChange={e => setQuickForm({ ...quickForm, unit: e.target.value })} /></div>
                <div><Label>Rack Location</Label><Input placeholder="e.g. A-1" value={quickForm.rackLocation} onChange={e => setQuickForm({ ...quickForm, rackLocation: e.target.value })} /></div>
                <div><Label>Category</Label><Select value={quickForm.categoryId} onValueChange={v => setQuickForm({ ...quickForm, categoryId: v })}><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger><SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>Manufacturer</Label><Input placeholder="e.g. Cipla" value={quickForm.manufacturer} onChange={e => setQuickForm({ ...quickForm, manufacturer: e.target.value })} /></div>
                <div className="col-span-1 sm:col-span-2"><Separator className="my-1" /><p className="text-xs text-slate-500 font-semibold">Pricing & Stock</p></div>
                <div><Label>Buy Price (₹) *</Label><Input type="number" placeholder="Cost price" value={quickForm.buyPrice || ''} onChange={e => setQuickForm({ ...quickForm, buyPrice: parseFloat(e.target.value) || 0 })} /></div>
                <div><Label>Selling Price (₹) *</Label><Input type="number" placeholder="Selling price" value={quickForm.sellPrice || ''} onChange={e => setQuickForm({ ...quickForm, sellPrice: parseFloat(e.target.value) || 0 })} /></div>
                <div><Label>MRP (₹)</Label><Input type="number" placeholder="Max retail price" value={quickForm.mrp || ''} onChange={e => setQuickForm({ ...quickForm, mrp: parseFloat(e.target.value) || 0 })} /></div>
                <div><Label>Quantity *</Label><Input type="number" placeholder="Stock quantity" value={quickForm.quantity || ''} onChange={e => setQuickForm({ ...quickForm, quantity: parseInt(e.target.value) || 0 })} /></div>
                <div><Label>Expiry Date *</Label><Input type="date" value={quickForm.expiryDate} onChange={e => setQuickForm({ ...quickForm, expiryDate: e.target.value })} /></div>
                <div><Label>Reorder At</Label><Input type="number" placeholder="Alert level" value={quickForm.reorderLevel || ''} onChange={e => setQuickForm({ ...quickForm, reorderLevel: parseInt(e.target.value) || 10 })} /></div>
                <div className="sm:col-span-2"><Label>Reorder Qty</Label><Input type="number" placeholder="Reorder quantity" value={quickForm.reorderQty || ''} onChange={e => setQuickForm({ ...quickForm, reorderQty: parseInt(e.target.value) || 50 })} /></div>
              </div>
              <DialogFooter><Button className="bg-emerald-600 hover:bg-emerald-700" onClick={quickAddStock} disabled={quickAddLoading}>{quickAddLoading ? 'Adding...' : 'Add Stock'}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><Input placeholder="Search medicines..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" /></div>
        <Select value={selectedCat} onValueChange={setSelectedCat}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="All Categories" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Categories</SelectItem>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        <Button variant="outline" onClick={() => { setSelectedCat('all'); setSearch('') }}>Clear</Button>
      </div>

      {/* Medicine List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" /></div>
          ) : (
            <ScrollArea className="w-full"><Table>
              <TableHeader>
                <TableRow><TableHead>Medicine</TableHead><TableHead className="hidden sm:table-cell">Category</TableHead><TableHead className="hidden sm:table-cell">Strength</TableHead><TableHead>Stock</TableHead><TableHead className="hidden md:table-cell">Price</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(med => {
                  const totalStock = med.batches.reduce((s, b) => s + b.quantity, 0)
                  const prices = med.batches.filter(b => b.quantity > 0).map(b => b.sellingPrice)
                  const minPrice = prices.length ? Math.min(...prices) : 0
                  const maxPrice = prices.length ? Math.max(...prices) : 0
                  const isLow = totalStock <= med.reorderLevel
                  return (
                    <TableRow key={med.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setShowBatch(med)}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{med.name}</p>
                          <p className="text-xs text-slate-500">{med.genericName || ''}</p>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="hidden sm:table-cell">{med.category.name}</Badge></TableCell>
                      <TableCell className="text-sm hidden sm:table-cell">{med.strength || '-'}</TableCell>
                      <TableCell>
                        <span className={`font-semibold ${isLow ? 'text-red-600' : ''}`}>{totalStock}</span>
                        <span className="text-xs text-slate-400 ml-1">{med.unit}</span>
                      </TableCell>
                      <TableCell className="text-sm hidden md:table-cell">
                        {prices.length > 0 ? `₹${minPrice.toFixed(2)}${maxPrice !== minPrice ? ` - ₹${maxPrice.toFixed(2)}` : ''}` : 'N/A'}
                      </TableCell>
                      <TableCell>
                        {isLow ? <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />Low</Badge> :
                         med.batches.some(b => new Date(b.expiryDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) && b.quantity > 0)
                         ? <Badge variant="secondary" className="bg-amber-100 text-amber-700">Expiring</Badge>
                         : <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">OK</Badge>}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                          <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => openEdit(med)}><Edit className="w-3.5 h-3.5" /></Button>
                          <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => deleteMedicine(med.id)}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-400">No medicines found</TableCell></TableRow>}
              </TableBody>
            </Table></ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editMed} onOpenChange={() => setEditMed(null)}>
        <DialogContent className="max-w-lg w-[calc(100%-2rem)]">
          <DialogHeader><DialogTitle>Edit Medicine</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="col-span-1 sm:col-span-2"><Label>Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Generic Name</Label><Input value={form.genericName} onChange={e => setForm({ ...form, genericName: e.target.value })} /></div>
            <div><Label>Brand Name</Label><Input value={form.brandName} onChange={e => setForm({ ...form, brandName: e.target.value })} /></div>
            <div><Label>Category</Label><Select value={form.categoryId} onValueChange={v => setForm({ ...form, categoryId: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Manufacturer</Label><Input value={form.manufacturer} onChange={e => setForm({ ...form, manufacturer: e.target.value })} /></div>
            <div><Label>Dosage Form</Label><Input value={form.dosageForm} onChange={e => setForm({ ...form, dosageForm: e.target.value })} /></div>
            <div><Label>Strength</Label><Input value={form.strength} onChange={e => setForm({ ...form, strength: e.target.value })} /></div>
            <div><Label>Unit</Label><Input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} /></div>
            <div><Label>Rack</Label><Input value={form.rackLocation} onChange={e => setForm({ ...form, rackLocation: e.target.value })} /></div>
            <div><Label>Reorder Level</Label><Input type="number" value={form.reorderLevel} onChange={e => setForm({ ...form, reorderLevel: parseInt(e.target.value) || 0 })} /></div>
            <div><Label>Reorder Qty</Label><Input type="number" value={form.reorderQty} onChange={e => setForm({ ...form, reorderQty: parseInt(e.target.value) || 0 })} /></div>
            <div><Label>Tax Rate (%)</Label><Input type="number" value={form.taxRate} onChange={e => setForm({ ...form, taxRate: parseFloat(e.target.value) || 0 })} /></div>
          </div>
          <DialogFooter><Button onClick={updateMedicine}>Update</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Detail Dialog */}
      <Dialog open={!!showBatch} onOpenChange={() => setShowBatch(null)}>
        <DialogContent className="max-w-2xl w-[calc(100%-2rem)]">
          <DialogHeader>
            <DialogTitle>{showBatch?.name} - Batch Details</DialogTitle>
            <DialogDescription>Manage stock batches and expiry tracking</DialogDescription>
          </DialogHeader>
          {showBatch && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg">
                <p className="text-sm"><span className="text-slate-500">Generic:</span> {showBatch.genericName || '-'}</p>
                <p className="text-sm"><span className="text-slate-500">Category:</span> {showBatch.category.name}</p>
                <p className="text-sm"><span className="text-slate-500">Total Stock:</span> <strong>{showBatch.batches.reduce((s, b) => s + b.quantity, 0)}</strong></p>
                <p className="text-sm"><span className="text-slate-500">Reorder at:</span> {showBatch.reorderLevel}</p>
              </div>

              <ScrollArea className="w-full"><Table>
                <TableHeader><TableRow><TableHead>Batch</TableHead><TableHead>Expiry</TableHead><TableHead>Qty</TableHead><TableHead className="hidden sm:table-cell">Cost</TableHead><TableHead>Sell</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {showBatch.batches.map(b => {
                    const expired = new Date(b.expiryDate) <= new Date()
                    const nearExpiry = !expired && new Date(b.expiryDate) <= new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
                    return (
                      <TableRow key={b.id}>
                        <TableCell className="font-mono text-sm">{b.batchNo}</TableCell>
                        <TableCell><span className={expired ? 'text-red-600 font-semibold' : nearExpiry ? 'text-amber-600' : ''}>{new Date(b.expiryDate).toLocaleDateString()}</span></TableCell>
                        <TableCell><strong>{b.quantity}</strong></TableCell>
                        <TableCell>₹{b.purchasePrice.toFixed(2)}</TableCell>
                        <TableCell>₹{b.sellingPrice.toFixed(2)}</TableCell>
                        <TableCell>
                          {expired ? <Badge variant="destructive">Expired</Badge> :
                           nearExpiry ? <Badge variant="secondary" className="bg-amber-100 text-amber-700">Expiring</Badge> :
                           <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">OK</Badge>}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table></ScrollArea>

              <Separator />
              <div>
                <h4 className="font-semibold text-sm mb-3">Add New Batch</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div><Label className="text-xs">Batch No</Label><Input value={batchForm.batchNo} onChange={e => setBatchForm({ ...batchForm, batchNo: e.target.value })} /></div>
                  <div><Label className="text-xs">Expiry Date</Label><Input type="date" value={batchForm.expiryDate} onChange={e => setBatchForm({ ...batchForm, expiryDate: e.target.value })} /></div>
                  <div><Label className="text-xs">Quantity</Label><Input type="number" value={batchForm.quantity} onChange={e => setBatchForm({ ...batchForm, quantity: parseInt(e.target.value) || 0 })} /></div>
                  <div><Label className="text-xs">Purchase Price</Label><Input type="number" value={batchForm.purchasePrice} onChange={e => setBatchForm({ ...batchForm, purchasePrice: parseFloat(e.target.value) || 0 })} /></div>
                  <div><Label className="text-xs">Selling Price</Label><Input type="number" value={batchForm.sellingPrice} onChange={e => setBatchForm({ ...batchForm, sellingPrice: parseFloat(e.target.value) || 0 })} /></div>
                  <div><Label className="text-xs">MRP</Label><Input type="number" value={batchForm.mrp} onChange={e => setBatchForm({ ...batchForm, mrp: parseFloat(e.target.value) || 0 })} /></div>
                </div>
                <Button className="mt-3" onClick={addBatch}>Add Batch</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ==================== PURCHASES ====================
function PurchasesPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [medicines, setMedicines] = useState<Medicine[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null)
  const { toast } = useToast()

  const [poForm, setPoForm] = useState({ supplierId: '', expectedDate: '', notes: '', status: 'Pending' })
  const [poItems, setPoItems] = useState<{ medicineId: string; medicineName: string; quantity: number; unitPrice: number }[]>([])

  useEffect(() => { fetchPurchases() }, [])

  const fetchPurchases = async () => {
    setLoading(true)
    try {
      const [o, s, m] = await Promise.all([fetch('/api/purchases'), fetch('/api/suppliers'), fetch('/api/medicines')])
      setOrders(await o.json())
      setSuppliers(await s.json())
      setMedicines(await m.json())
    } catch { /* silent */ } finally { setLoading(false) }
  }

  const addPoItem = () => setPoItems([...poItems, { medicineId: '', medicineName: '', quantity: 1, unitPrice: 0 }])

  const updatePoItem = (i: number, field: string, value: string | number) => {
    const updated = [...poItems]
    updated[i] = { ...updated[i], [field]: value }
    if (field === 'medicineId') {
      const med = medicines.find(m => m.id === value)
      if (med) updated[i].medicineName = med.name
    }
    setPoItems(updated)
  }

  const removePoItem = (i: number) => setPoItems(poItems.filter((_, idx) => idx !== i))

  const createPO = async () => {
    try {
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...poForm,
          expectedDate: poForm.expectedDate || null,
          items: poItems.filter(i => i.medicineId).map(i => ({ ...i, total: i.quantity * i.unitPrice })),
        }),
      })
      if (!res.ok) throw new Error('Failed')
      toast({ title: 'Purchase Order created' })
      setShowCreate(false)
      setPoForm({ supplierId: '', expectedDate: '', notes: '', status: 'Pending' })
      setPoItems([])
      fetchPurchases()
    } catch { toast({ title: 'Failed to create PO', variant: 'destructive' }) }
  }

  const updateStatus = async (id: string, status: string) => {
    try {
      await fetch('/api/purchases', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) })
      toast({ title: `Order ${status.toLowerCase()}` })
      fetchPurchases()
    } catch { toast({ title: 'Failed', variant: 'destructive' }) }
  }

  const statusColor = (s: string) => {
    switch (s) {
      case 'Pending': return 'bg-amber-100 text-amber-700'
      case 'Ordered': return 'bg-blue-100 text-blue-700'
      case 'Received': return 'bg-emerald-100 text-emerald-700'
      case 'Partial': return 'bg-purple-100 text-purple-700'
      case 'Cancelled': return 'bg-red-100 text-red-700'
      default: return ''
    }
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-xl md:text-2xl font-bold text-slate-900">Purchase Orders</h2>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" /> New Purchase Order</Button></DialogTrigger>
          <DialogContent className="max-w-2xl w-[calc(100%-2rem)]">
            <DialogHeader><DialogTitle>Create Purchase Order</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label>Supplier *</Label><Select value={poForm.supplierId} onValueChange={v => setPoForm({ ...poForm, supplierId: v })}><SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger><SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>Expected Date</Label><Input type="date" value={poForm.expectedDate} onChange={e => setPoForm({ ...poForm, expectedDate: e.target.value })} /></div>
                <div className="col-span-1 sm:col-span-2"><Label>Notes</Label><Input value={poForm.notes} onChange={e => setPoForm({ ...poForm, notes: e.target.value })} /></div>
              </div>

              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between"><h4 className="font-semibold text-sm">Items</h4><Button size="sm" variant="outline" onClick={addPoItem}><Plus className="w-3 h-3 mr-1" />Add Item</Button></div>
                {poItems.map((item, i) => (
                  <div key={i} className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
                    <div className="col-span-2 sm:col-span-1"><Label className="text-xs">Medicine</Label><Select value={item.medicineId} onValueChange={v => updatePoItem(i, 'medicineId', v)}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{medicines.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label className="text-xs">Qty</Label><Input type="number" value={item.quantity} onChange={e => updatePoItem(i, 'quantity', parseInt(e.target.value) || 0)} /></div>
                    <div><Label className="text-xs">Unit Price</Label><Input type="number" value={item.unitPrice} onChange={e => updatePoItem(i, 'unitPrice', parseFloat(e.target.value) || 0)} /></div>
                    <Button size="icon" variant="ghost" onClick={() => removePoItem(i)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                  </div>
                ))}
              </div>
              <div className="text-right text-sm font-medium">Total: ₹{poItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0).toFixed(2)}</div>
            </div>
            <DialogFooter><Button onClick={createPO} disabled={!poForm.supplierId || poItems.length === 0}>Create Order</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" /></div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="w-full"><Table>
              <TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Supplier</TableHead><TableHead className="hidden sm:table-cell">Date</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {orders.map(po => (
                  <TableRow key={po.id}>
                    <TableCell className="font-mono text-sm">{po.orderNo}</TableCell>
                    <TableCell>{po.supplier?.name || 'Unknown'}</TableCell>
                    <TableCell className="text-sm hidden sm:table-cell">{new Date(po.date).toLocaleDateString()}</TableCell>
                    <TableCell className="font-semibold">₹{po.totalAmount.toFixed(2)}</TableCell>
                    <TableCell><Badge className={statusColor(po.status)}>{po.status}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => setSelectedOrder(po)}><Eye className="w-3 h-3" /></Button>
                        {po.status === 'Pending' && <Button size="sm" variant="outline" onClick={() => updateStatus(po.id, 'Ordered')}>Ordered</Button>}
                        {po.status === 'Ordered' && <Button size="sm" variant="outline" onClick={() => updateStatus(po.id, 'Received')}>Received</Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {orders.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-400">No purchase orders</TableCell></TableRow>}
              </TableBody>
            </Table></ScrollArea>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-lg w-[calc(100%-2rem)]">
          <DialogHeader><DialogTitle>{selectedOrder?.orderNo}</DialogTitle></DialogHeader>
          {selectedOrder && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <p><span className="text-slate-500">Supplier:</span> {selectedOrder.supplier?.name}</p>
                <p><span className="text-slate-500">Date:</span> {new Date(selectedOrder.date).toLocaleDateString()}</p>
                <p><span className="text-slate-500">Status:</span> <Badge className={statusColor(selectedOrder.status)}>{selectedOrder.status}</Badge></p>
                <p><span className="text-slate-500">Amount:</span> ₹{selectedOrder.totalAmount.toFixed(2)}</p>
              </div>
              <Separator />
              <ScrollArea className="w-full"><Table>
                <TableHeader><TableRow><TableHead>Medicine</TableHead><TableHead>Qty</TableHead><TableHead>Price</TableHead><TableHead>Total</TableHead></TableRow></TableHeader>
                <TableBody>
                  {selectedOrder.items.map(item => (
                    <TableRow key={item.id}><TableCell className="text-sm">{item.medicineName || '-'}</TableCell><TableCell>{item.quantity}</TableCell><TableCell>₹{item.unitPrice.toFixed(2)}</TableCell><TableCell>₹{item.total.toFixed(2)}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table></ScrollArea>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ==================== SUPPLIERS ====================
function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [editSup, setEditSup] = useState<Supplier | null>(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', gstNumber: '', contactPerson: '' })
  const { toast } = useToast()

  useEffect(() => { fetchSuppliers() }, [])

  const fetchSuppliers = async () => {
    setLoading(true)
    try { setSuppliers(await (await fetch('/api/suppliers')).json()) } catch { /* silent */ } finally { setLoading(false) }
  }

  const create = async () => {
    try {
      await fetch('/api/suppliers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      toast({ title: 'Supplier added' }); setShowAdd(false); setForm({ name: '', phone: '', email: '', address: '', gstNumber: '', contactPerson: '' }); fetchSuppliers()
    } catch { toast({ title: 'Failed', variant: 'destructive' }) }
  }

  const update = async () => {
    if (!editSup) return
    try {
      await fetch('/api/suppliers', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editSup.id, ...form }) })
      toast({ title: 'Supplier updated' }); setEditSup(null); fetchSuppliers()
    } catch { toast({ title: 'Failed', variant: 'destructive' }) }
  }

  const remove = async (id: string) => {
    try { await fetch(`/api/suppliers?id=${id}`, { method: 'DELETE' }); toast({ title: 'Deleted' }); fetchSuppliers() }
    catch { toast({ title: 'Failed', variant: 'destructive' }) }
  }

  const openEdit = (s: Supplier) => {
    setEditSup(s)
    setForm({ name: s.name, phone: s.phone, email: s.email || '', address: s.address || '', gstNumber: s.gstNumber || '', contactPerson: s.contactPerson || '' })
  }

  const SupplierForm = ({ onSave, btnText }: { onSave: () => void; btnText: string }) => (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
        <div><Label>Phone *</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
        <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
        <div><Label>Contact Person</Label><Input value={form.contactPerson} onChange={e => setForm({ ...form, contactPerson: e.target.value })} /></div>
        <div><Label>GST Number</Label><Input value={form.gstNumber} onChange={e => setForm({ ...form, gstNumber: e.target.value })} /></div>
      </div>
      <div><Label>Address</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
      <DialogFooter><Button onClick={onSave}>{btnText}</Button></DialogFooter>
    </div>
  )

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-xl md:text-2xl font-bold text-slate-900">Suppliers</h2>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" /> Add Supplier</Button></DialogTrigger>
          <DialogContent className="max-w-lg w-[calc(100%-2rem)]"><DialogHeader><DialogTitle>Add Supplier</DialogTitle></DialogHeader><SupplierForm onSave={create} btnText="Add Supplier" /></DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map(s => (
            <Card key={s.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{s.name}</h3>
                    <p className="text-sm text-slate-500">{s.phone}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => openEdit(s)}><Edit className="w-3.5 h-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => remove(s.id)}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>
                  </div>
                </div>
                <div className="mt-3 space-y-1 text-sm text-slate-500">
                  {s.email && <p>{s.email}</p>}
                  {s.contactPerson && <p>Contact: {s.contactPerson}</p>}
                  {s.gstNumber && <p>GST: {s.gstNumber}</p>}
                  {s.address && <p className="text-xs">{s.address}</p>}
                </div>
                <div className="mt-3 pt-3 border-t flex items-center justify-between text-sm">
                  <span className="text-slate-500">Balance:</span>
                  <span className={`font-semibold ${s.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>₹{s.balance.toFixed(2)}</span>
                </div>
                <Badge variant="secondary" className="mt-2">{s._count?.purchaseOrders || 0} orders</Badge>
              </CardContent>
            </Card>
          ))}
          {suppliers.length === 0 && <div className="col-span-3 text-center py-12 text-slate-400">No suppliers added yet</div>}
        </div>
      )}

      <Dialog open={!!editSup} onOpenChange={() => setEditSup(null)}>
        <DialogContent className="max-w-lg w-[calc(100%-2rem)]"><DialogHeader><DialogTitle>Edit Supplier</DialogTitle></DialogHeader><SupplierForm onSave={update} btnText="Update" /></DialogContent>
      </Dialog>
    </div>
  )
}

// ==================== REPORTS ====================
function ReportsPage() {
  const [reportType, setReportType] = useState('sales-summary')
  const [reportData, setReportData] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  const [sales, setSales] = useState<Sale[]>([])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => { fetchReport() }, [reportType])

  const fetchReport = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ type: reportType })
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)
      const res = await fetch(`/api/reports?${params}`)
      setReportData(await res.json())
    } catch { /* silent */ } finally { setLoading(false) }
  }

  useEffect(() => {
    fetch('/api/sales?stats=true').then(r => r.json()).then(setSales).catch(() => {})
  }, [])

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
      <h2 className="text-xl md:text-2xl font-bold text-slate-900">Reports & Analytics</h2>

      <div className="flex gap-3 flex-wrap">
        {[
          { id: 'sales-summary', label: 'Sales Summary', icon: <TrendingUp className="w-4 h-4" /> },
          { id: 'profit-report', label: 'Profit Report', icon: <DollarSign className="w-4 h-4" /> },
          { id: 'inventory-valuation', label: 'Inventory Valuation', icon: <Package className="w-4 h-4" /> },
          { id: 'low-stock', label: 'Low Stock', icon: <AlertTriangle className="w-4 h-4" /> },
          { id: 'expiry-report', label: 'Expiry Report', icon: <CalendarDays className="w-4 h-4" /> },
        ].map(r => (
          <Button key={r.id} variant={reportType === r.id ? 'default' : 'outline'} onClick={() => setReportType(r.id)} className="gap-2">
            {r.icon} {r.label}
          </Button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1"><Label className="text-xs">From</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
        <div className="flex-1"><Label className="text-xs">To</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
        <div className="flex items-end"><Button variant="outline" onClick={fetchReport}><RefreshCw className="w-4 h-4 mr-1" />Refresh</Button></div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" /></div>
      ) : (
        <Card>
          <CardContent className="p-3 sm:p-6">
            {reportType === 'sales-summary' && (
              <div>
                <h3 className="font-semibold mb-4">Sales Summary</h3>
                <ScrollArea className="w-full"><Table>
                  <TableHeader><TableRow><TableHead>Period</TableHead><TableHead>Total Sales</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {(reportData as { date: string; sales: number; count: number }[])?.map((row, i) => (
                      <TableRow key={i}><TableCell className="text-sm">{row.date}</TableCell><TableCell className="font-semibold text-sm">₹{row.sales.toFixed(2)} ({row.count} txns)</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table></ScrollArea>
              </div>
            )}
            {reportType === 'profit-report' && (
              <div>
                <h3 className="font-semibold mb-4">Profit Analysis</h3>
                {(reportData as { totals: { revenue: number; cost: number; profit: number } })?.totals && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <StatCard title="Revenue" value={`₹${(reportData as { totals: { revenue: number } }).totals.revenue.toFixed(2)}`} subtitle="" icon={<TrendingUp className="w-5 h-5" />} color="blue" />
                    <StatCard title="Cost" value={`₹${(reportData as { totals: { cost: number } }).totals.cost.toFixed(2)}`} subtitle="" icon={<Package className="w-5 h-5" />} color="amber" />
                    <StatCard title="Profit" value={`₹${(reportData as { totals: { profit: number } }).totals.profit.toFixed(2)}`} subtitle="" icon={<DollarSign className="w-5 h-5" />} color="emerald" />
                  </div>
                )}
              </div>
            )}
            {reportType === 'inventory-valuation' && (
              <div>
                <h3 className="font-semibold mb-4">Inventory Valuation</h3>
                {(reportData as { totalCost: number; totalRevenue: number; potentialProfit: number })?.totalCost !== undefined && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <StatCard title="Cost Value" value={`₹${(reportData as { totalCost: number }).totalCost.toFixed(2)}`} subtitle="" icon={<Package className="w-5 h-5" />} color="blue" />
                    <StatCard title="Revenue" value={`₹${(reportData as { totalRevenue: number }).totalRevenue.toFixed(2)}`} subtitle="" icon={<TrendingUp className="w-5 h-5" />} color="emerald" />
                    <StatCard title="Profit" value={`₹${(reportData as { potentialProfit: number }).potentialProfit.toFixed(2)}`} subtitle="" icon={<DollarSign className="w-5 h-5" />} color="amber" />
                  </div>
                )}
              </div>
            )}
            {reportType === 'low-stock' && (
              <div>
                <h3 className="font-semibold mb-4">Low Stock Items</h3>
                <ScrollArea className="w-full"><Table>
                  <TableHeader><TableRow><TableHead>Medicine</TableHead><TableHead className="hidden sm:table-cell">Category</TableHead><TableHead>Stock</TableHead><TableHead>Reorder</TableHead><TableHead className="hidden sm:table-cell">Reorder Qty</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {(reportData as { id: string; name: string; genericName: string | null; category: string; currentStock: number; reorderLevel: number; reorderQty: number }[])?.map(item => (
                      <TableRow key={item.id}>
                        <TableCell><div><p className="font-medium text-sm">{item.name}</p><p className="text-xs text-slate-500">{item.genericName || ''}</p></div></TableCell>
                        <TableCell className="hidden sm:table-cell"><Badge variant="outline">{item.category}</Badge></TableCell>
                        <TableCell className="font-semibold text-red-600">{item.currentStock}</TableCell>
                        <TableCell>{item.reorderLevel}</TableCell>
                        <TableCell className="hidden sm:table-cell">{item.reorderQty}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table></ScrollArea>
              </div>
            )}
            {reportType === 'expiry-report' && (
              <div>
                <h3 className="font-semibold mb-4">Batch Expiry Report</h3>
                <ScrollArea className="w-full"><Table>
                  <TableHeader><TableRow><TableHead>Medicine</TableHead><TableHead className="hidden sm:table-cell">Batch</TableHead><TableHead>Expiry</TableHead><TableHead>Qty</TableHead><TableHead>Days</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {(reportData as { id: string; medicineName: string; batchNo: string; expiryDate: string; quantity: number; daysToExpiry: number; status: string }[])?.map(item => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium text-sm">{item.medicineName}</TableCell>
                        <TableCell className="font-mono text-xs hidden sm:table-cell">{item.batchNo}</TableCell>
                        <TableCell className="text-sm">{new Date(item.expiryDate).toLocaleDateString()}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell className={item.daysToExpiry < 0 ? 'text-red-600 font-semibold' : item.daysToExpiry < 30 ? 'text-amber-600' : ''}>{item.daysToExpiry}</TableCell>
                        <TableCell>
                          {item.status === 'Expired' ? <Badge variant="destructive">Expired</Badge> :
                           item.status === 'Critical' ? <Badge variant="destructive">Critical</Badge> :
                           item.status === 'Warning' ? <Badge variant="secondary" className="bg-amber-100 text-amber-700">Warning</Badge> :
                           <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">OK</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table></ScrollArea>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ==================== EXPIRY TRACKER ====================
function ExpiryPage() {
  const [expired, setExpired] = useState<Batch[]>([])
  const [expiring, setExpiring] = useState<Batch[]>([])
  const [tab, setTab] = useState('expiring')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/batches?expired=true').then(r => r.json()),
      fetch('/api/batches?expiring=true').then(r => r.json()),
    ]).then(([e, x]) => { setExpired(e); setExpiring(x) }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const BatchRow = ({ b }: { b: Batch }) => {
    const days = Math.ceil((new Date(b.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    return (
      <TableRow>
        <TableCell><div><p className="font-medium text-sm">{(b as unknown as { medicine: { name: string } }).medicine?.name}</p><p className="text-xs text-slate-500">{(b as unknown as { medicine: { category: { name: string } } }).medicine?.category?.name}</p></div></TableCell>
        <TableCell className="font-mono text-sm">{b.batchNo}</TableCell>
        <TableCell className={days <= 0 ? 'text-red-600 font-semibold' : days <= 30 ? 'text-amber-600 font-semibold' : ''}>{new Date(b.expiryDate).toLocaleDateString()}</TableCell>
        <TableCell className="font-semibold">{b.quantity}</TableCell>
        <TableCell className={days <= 0 ? 'text-red-600' : days <= 30 ? 'text-amber-600' : 'text-slate-600'}>{days <= 0 ? `${Math.abs(days)} days ago` : `${days} days left`}</TableCell>
        <TableCell>₹{b.sellingPrice.toFixed(2)}</TableCell>
      </TableRow>
    )
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
      <h2 className="text-xl md:text-2xl font-bold text-slate-900">Expiry Tracker</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-red-200 bg-red-50"><CardContent className="p-5"><p className="text-sm text-red-600">Expired</p><p className="text-3xl font-bold text-red-700">{expired.length}</p><p className="text-xs text-red-500">Batches past expiry</p></CardContent></Card>
        <Card className="border-amber-200 bg-amber-50"><CardContent className="p-5"><p className="text-sm text-amber-600">Expiring in 90 days</p><p className="text-3xl font-bold text-amber-700">{expiring.length}</p><p className="text-xs text-amber-500">Need attention</p></CardContent></Card>
        <Card className="border-emerald-200 bg-emerald-50"><CardContent className="p-5"><p className="text-sm text-emerald-600">Total Value at Risk</p><p className="text-3xl font-bold text-emerald-700">₹{[...expired, ...expiring].reduce((s, b) => s + b.quantity * b.sellingPrice, 0).toFixed(0)}</p><p className="text-xs text-emerald-500">Expired + Expiring value</p></CardContent></Card>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" /></div>
      ) : (
        <Card>
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList className="ml-6"><TabsTrigger value="expiring">Expiring Soon ({expiring.length})</TabsTrigger><TabsTrigger value="expired">Expired ({expired.length})</TabsTrigger></TabsList>
            <TabsContent value="expiring">
              <ScrollArea className="w-full"><Table>
                <TableHeader><TableRow><TableHead>Medicine</TableHead><TableHead className="hidden sm:table-cell">Batch</TableHead><TableHead>Expiry</TableHead><TableHead>Qty</TableHead><TableHead className="hidden sm:table-cell">Days Left</TableHead><TableHead className="hidden md:table-cell">Price</TableHead></TableRow></TableHeader>
                <TableBody>
                  {expiring.map(b => <BatchRow key={b.id} b={b} />)}
                  {expiring.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-400">No batches expiring soon</TableCell></TableRow>}
                </TableBody>
              </Table></ScrollArea>
            </TabsContent>
            <TabsContent value="expired">
              <ScrollArea className="w-full"><Table>
                <TableHeader><TableRow><TableHead>Medicine</TableHead><TableHead className="hidden sm:table-cell">Batch</TableHead><TableHead>Expiry</TableHead><TableHead>Qty</TableHead><TableHead className="hidden sm:table-cell">Overdue</TableHead><TableHead className="hidden md:table-cell">Price</TableHead></TableRow></TableHeader>
                <TableBody>
                  {expired.map(b => <BatchRow key={b.id} b={b} />)}
                  {expired.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-400">No expired batches</TableCell></TableRow>}
                </TableBody>
              </Table></ScrollArea>
            </TabsContent>
          </Tabs>
        </Card>
      )}
    </div>
  )
}

// ==================== SUBSTITUTES ====================
function SubstitutesPage() {
  const [medicines, setMedicines] = useState<Medicine[]>([])
  const [selectedMed, setSelectedMed] = useState<Medicine | null>(null)
  const [substitutes, setSubstitutes] = useState<Medicine[]>([])
  const [addTarget, setAddTarget] = useState<string>('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => { fetch('/api/medicines').then(r => r.json()).then(setMedicines).catch(() => {}).finally(() => setLoading(false)) }, [])

  const selectMed = async (med: Medicine) => {
    setSelectedMed(med)
    const subs = await fetch(`/api/substitutes?medicineId=${med.id}`).then(r => r.json())
    setSubstitutes(subs)
    setSearch('')
    setAddTarget('')
  }

  const addSubstitute = async () => {
    if (!selectedMed || !addTarget) return
    try {
      await fetch('/api/substitutes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ medicineId: selectedMed.id, substituteId: addTarget }) })
      toast({ title: 'Substitute added' })
      const subs = await fetch(`/api/substitutes?medicineId=${selectedMed.id}`).then(r => r.json())
      setSubstitutes(subs)
      setAddTarget('')
    } catch { toast({ title: 'Failed', variant: 'destructive' }) }
  }

  const removeSubstitute = async (subId: string) => {
    if (!selectedMed) return
    try {
      await fetch('/api/substitutes', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ medicineId: selectedMed.id, substituteId: subId }) })
      toast({ title: 'Removed' })
      setSubstitutes(substitutes.filter(s => s.id !== subId))
    } catch { toast({ title: 'Failed', variant: 'destructive' }) }
  }

  // Find generic equivalents (same genericName, different brand)
  const genericEquivalents = selectedMed?.genericName
    ? medicines.filter(m => m.genericName === selectedMed.genericName && m.id !== selectedMed.id)
    : []

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
      <h2 className="text-xl md:text-2xl font-bold text-slate-900">Substitute & Generic Discovery</h2>
      <p className="text-slate-500">Find substitute medicines and generic equivalents for any brand-name drug</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Medicine Selection */}
        <Card>
          <CardHeader><CardTitle className="text-base">Select Medicine</CardTitle></CardHeader>
          <CardContent>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input placeholder="Search medicine..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
            </div>
            <ScrollArea className="h-96">
              <div className="space-y-1">
                {medicines.filter(m => !search || m.name.toLowerCase().includes(search.toLowerCase()) || (m.genericName || '').toLowerCase().includes(search.toLowerCase())).map(med => (
                  <button key={med.id} onClick={() => selectMed(med)} className={`w-full text-left p-3 rounded-lg text-sm hover:bg-emerald-50 ${selectedMed?.id === med.id ? 'bg-emerald-50 border border-emerald-200' : 'hover:bg-slate-50'}`}>
                    <p className="font-medium">{med.name}</p>
                    <p className="text-xs text-slate-500">{med.genericName || 'No generic'} | {med.strength || ''} | {med.category.name}</p>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Substitutes & Generics */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Substitutes for {selectedMed?.name || '...'}</CardTitle></CardHeader>
            <CardContent>
              {!selectedMed ? <p className="text-slate-400 text-sm">Select a medicine to view substitutes</p> : (
                <>
                  {substitutes.length > 0 ? (
                    <div className="space-y-2 mb-4">
                      {substitutes.map(s => (
                        <div key={s.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                          <div>
                            <p className="text-sm font-medium">{s.name}</p>
                            <p className="text-xs text-slate-500">{s.genericName} | {s.strength || ''} | {s.category.name}</p>
                            {s.batches.length > 0 && <p className="text-xs text-emerald-600">In stock: {s.batches.reduce((sum, b) => sum + b.quantity, 0)} units</p>}
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => removeSubstitute(s.id)}><Trash2 className="w-3 h-3 text-red-500" /></Button>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-slate-400 text-sm mb-4">No substitutes added yet</p>}

                  <div className="flex gap-2">
                    <Select value={addTarget} onValueChange={setAddTarget}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Select medicine to add as substitute" /></SelectTrigger>
                      <SelectContent>{medicines.filter(m => m.id !== selectedMed.id && !substitutes.find(s => s.id === m.id)).map(m => <SelectItem key={m.id} value={m.id}>{m.name} ({m.genericName || 'Generic'})</SelectItem>)}</SelectContent>
                    </Select>
                    <Button onClick={addSubstitute} disabled={!addTarget}>Add</Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Generic Equivalents */}
          {selectedMed?.genericName && genericEquivalents.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Generic Equivalents (Same: {selectedMed.genericName})</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {genericEquivalents.map(m => (
                    <div key={m.id} className="flex items-center justify-between p-2 bg-blue-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium">{m.name}</p>
                        <p className="text-xs text-slate-500">{m.brandName || m.name} | {m.strength || ''} | {m.manufacturer || ''}</p>
                        {m.batches.length > 0 && <p className="text-xs text-emerald-600">In stock: {m.batches.reduce((sum, b) => sum + b.quantity, 0)} units | ₹{Math.min(...m.batches.filter(b => b.quantity > 0).map(b => b.sellingPrice))}</p>}
                      </div>
                      <Button size="sm" variant="outline" onClick={() => addSubstitute() || (() => { setAddTarget(m.id) })()}>Use as Substitute</Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

// ==================== IMPORT ====================
function ImportPage() {
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ imported: number; errors: string[]; total: number } | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const { toast } = useToast()

  const handleImport = async () => {
    if (!file) return toast({ title: 'Select a file first', variant: 'destructive' })
    setImporting(true)
    setResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/import', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data)
      toast({ title: `Imported ${data.imported} of ${data.total} items` })
    } catch (e: unknown) {
      toast({ title: 'Import failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    } finally { setImporting(false) }
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
      <h2 className="text-xl md:text-2xl font-bold text-slate-900">Import Data</h2>
      <p className="text-slate-500">Import medicines and inventory data from CSV or Excel files</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Upload File</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-emerald-400 transition-colors">
              <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-sm text-slate-500 mb-3">Drag & drop or click to upload</p>
              <Input type="file" accept=".csv,.xlsx,.xls,.tsv" onChange={e => setFile(e.target.files?.[0] || null)} className="max-w-xs mx-auto" />
            </div>
            {file && <p className="text-sm">Selected: {file.name}</p>}
            <Button onClick={handleImport} disabled={!file || importing} className="w-full">
              {importing ? <><div className="animate-spin w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full" />Importing...</> : <><Upload className="w-4 h-4 mr-2" />Import Data</>}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">CSV Format Guide</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-slate-600 space-y-3">
              <p>Your CSV file should have these column headers (case-insensitive):</p>
              <div className="bg-slate-50 p-3 rounded-lg font-mono text-xs space-y-1">
                <p>name, generic_name, category, batch_no, expiry_date,</p>
                <p>purchase_price, selling_price, quantity, manufacturer,</p>
                <p>strength, unit</p>
              </div>
              <Separator />
              <div>
                <p className="font-medium">Example row:</p>
                <p className="bg-slate-50 p-3 rounded-lg font-mono text-xs mt-1">
                  Paracetamol 500mg, Paracetamol, Analgesics, B2024-001, 2025-12-31, 15.00, 25.00, 100, ABC Pharma, 500mg, Strip
                </p>
              </div>
              <Separator />
              <div>
                <p className="font-medium mb-2">Supported Formats:</p>
                <div className="flex gap-2 flex-wrap">
                  <Badge>CSV</Badge><Badge>TSV (Tab-separated)</Badge>
                </div>
              </div>
            </div>

            {result && (
              <div className="space-y-2 p-3 bg-emerald-50 rounded-lg">
                <p className="font-medium text-emerald-700">Import Complete</p>
                <p className="text-sm text-emerald-600">Imported: {result.imported} / {result.total} rows</p>
                {result.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm text-amber-600 font-medium">Errors ({result.errors.length}):</p>
                    {result.errors.slice(0, 5).map((e, i) => <p key={i} className="text-xs text-amber-600">{e}</p>)}
                    {result.errors.length > 5 && <p className="text-xs text-amber-600">...and {result.errors.length - 5} more</p>}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ==================== USERS / TEAM MANAGEMENT ====================
function UsersPage({ currentUser }: { currentUser: CurrentUser | null }) {
  const { toast } = useToast()
  const [users, setUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null)

  // New user form
  const [newName, setNewName] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState('Staff')
  const [newPhone, setNewPhone] = useState('')

  // Edit user form
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editActive, setEditActive] = useState(true)
  const [editPassword, setEditPassword] = useState('')

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/users')
      const data = await res.json()
      setUsers(data)
    } catch { /* silent */ } finally { setLoading(false) }
  }

  useEffect(() => { fetchUsers() }, [])

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, username: newUsername, password: newPassword, role: newRole, phone: newPhone || null }),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: 'User Created', description: `${newName} can now sign in with username "${newUsername}"` })
        setShowAddDialog(false)
        setNewName(''); setNewUsername(''); setNewPassword(''); setNewRole('Staff'); setNewPhone('')
        fetchUsers()
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to create user', variant: 'destructive' })
    }
  }

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return
    try {
      const body: Record<string, unknown> = { id: editingUser.id, name: editName, role: editRole, phone: editPhone || null, active: editActive }
      if (editPassword) body.password = editPassword

      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: 'User Updated', description: `${editName} has been updated` })
        setShowEditDialog(false)
        setEditingUser(null); setEditPassword('')
        fetchUsers()
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to update user', variant: 'destructive' })
    }
  }

  const handleDeleteUser = async (user: UserRecord) => {
    if (!confirm(`Delete user "${user.name}"? This cannot be undone.`)) return
    try {
      const res = await fetch(`/api/users?id=${user.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        toast({ title: 'User Deleted', description: `${user.name} has been removed` })
        fetchUsers()
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to delete user', variant: 'destructive' })
    }
  }

  const openEdit = (user: UserRecord) => {
    setEditingUser(user)
    setEditName(user.name)
    setEditRole(user.role)
    setEditPhone(user.phone || '')
    setEditActive(user.active)
    setEditPassword('')
    setShowEditDialog(true)
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-900">User Management</h2>
          <p className="text-slate-500 text-sm">Manage team members and their access</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)} className="bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto">
          <UserPlus className="w-4 h-4 mr-2" /> Add User
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500 text-white flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Users</p>
              <p className="text-2xl font-bold">{users.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500 text-white flex items-center justify-center">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Active Users</p>
              <p className="text-2xl font-bold">{users.filter(u => u.active).length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center">
              <UserCog className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Admins</p>
              <p className="text-2xl font-bold">{users.filter(u => u.role === 'Admin').length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Users</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="w-full"><Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead className="hidden sm:table-cell">Username</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="hidden sm:table-cell">Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(user => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 text-xs font-bold">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium">{user.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm hidden sm:table-cell">{user.username}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === 'Admin' ? 'default' : 'secondary'}>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-500 hidden sm:table-cell">{user.phone || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={user.active ? 'default' : 'destructive'}>
                      {user.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-500 text-sm hidden md:table-cell">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(user)}>
                        <Edit className="w-3 h-3" />
                      </Button>
                      {user.id !== currentUser?.id && (
                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleDeleteUser(user)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-400 py-8">No users yet. Add your first team member!</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table></ScrollArea>
        </CardContent>
      </Card>

      {/* Add User Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg w-[calc(100%-2rem)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserPlus className="w-4 h-4 text-emerald-600" /> Add New User</DialogTitle>
            <DialogDescription>Create a new team member account</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddUser} className="space-y-4">
            <div>
              <Label>Full Name *</Label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Rahul Sharma" required />
            </div>
            <div>
              <Label>Username *</Label>
              <Input value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="e.g. rahul" required />
            </div>
            <div>
              <Label>Password *</Label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Minimum 4 characters" required minLength={4} />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Staff">Staff</SelectItem>
                  <SelectItem value="Admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Phone (optional)</Label>
              <Input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="e.g. 9876543210" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">Create User</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg w-[calc(100%-2rem)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Edit className="w-4 h-4 text-emerald-600" /> Edit User</DialogTitle>
            <DialogDescription>Update user details</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditUser} className="space-y-4">
            <div>
              <Label>Full Name</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} required />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Staff">Staff</SelectItem>
                  <SelectItem value="Admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="e.g. 9876543210" />
            </div>
            <div>
              <Label>Active</Label>
              <Select value={editActive ? 'true' : 'false'} onValueChange={v => setEditActive(v === 'true')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>New Password (leave blank to keep current)</Label>
              <Input type="password" value={editPassword} onChange={e => setEditPassword(e.target.value)} placeholder="Enter new password to change" minLength={4} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ==================== CATALOG / HOME DELIVERY ====================
function CatalogPage() {
  const [medicines, setMedicines] = useState<Medicine[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [search, setSearch] = useState('')
  const [selectedCat, setSelectedCat] = useState('all')
  const [loading, setLoading] = useState(true)
  const [showOrderForm, setShowOrderForm] = useState(false)
  const [showOrders, setShowOrders] = useState(false)
  const [orders, setOrders] = useState<any[]>([])
  const { toast } = useToast()

  // Order form
  const [orderName, setOrderName] = useState('')
  const [orderPhone, setOrderPhone] = useState('')
  const [orderAddress, setOrderAddress] = useState('')
  const [orderNotes, setOrderNotes] = useState('')
  const [orderPayment, setOrderPayment] = useState('Cash on Delivery')
  const [orderItems, setOrderItems] = useState<{ medicineId: string; medicineName: string; quantity: number; unitPrice: number }[]>([])
  const [orderLoading, setOrderLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [medsRes, catsRes] = await Promise.all([fetch('/api/medicines'), fetch('/api/categories')])
      const meds = await medsRes.json()
      setMedicines(meds)
      setCategories(await catsRes.json())
    } catch { /* silent */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = medicines.filter(m => {
    const inStock = m.batches.reduce((s, b) => s + b.quantity, 0) > 0
    if (!inStock) return false
    if (selectedCat !== 'all' && m.categoryId !== selectedCat) return false
    if (search && !m.name.toLowerCase().includes(search.toLowerCase()) && !(m.genericName || '').toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const addToOrder = (med: Medicine) => {
    const prices = med.batches.filter(b => b.quantity > 0).map(b => b.sellingPrice)
    const price = prices.length ? Math.min(...prices) : 0
    const existing = orderItems.find(i => i.medicineId === med.id)
    if (existing) {
      setOrderItems(orderItems.map(i => i.medicineId === med.id ? { ...i, quantity: i.quantity + 1 } : i))
    } else {
      setOrderItems([...orderItems, { medicineId: med.id, medicineName: med.name, quantity: 1, unitPrice: price }])
    }
    toast({ title: `${med.name} added to order` })
  }

  const updateOrderQty = (medicineId: string, quantity: number) => {
    if (quantity <= 0) {
      setOrderItems(orderItems.filter(i => i.medicineId !== medicineId))
    } else {
      setOrderItems(orderItems.map(i => i.medicineId === medicineId ? { ...i, quantity } : i))
    }
  }

  const orderTotal = orderItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  const deliveryCharge = 20

  const submitOrder = async () => {
    if (!orderName || !orderPhone || orderItems.length === 0) {
      toast({ title: 'Name, phone and items required', variant: 'destructive' })
      return
    }
    setOrderLoading(true)
    try {
      const res = await fetch('/api/catalog-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: orderName, customerPhone: orderPhone, customerAddress: orderAddress,
          notes: orderNotes, paymentMethod: orderPayment, items: orderItems,
        }),
      })
      const data = await res.json()
      toast({ title: 'Order placed!', description: `Order ${data.invoiceNo} - Total: ₹${data.total}` })
      setOrderItems([])
      setOrderName(''); setOrderPhone(''); setOrderAddress(''); setOrderNotes('')
      setShowOrderForm(false)
    } catch { toast({ title: 'Failed', variant: 'destructive' }) } finally { setOrderLoading(false) }
  }

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/catalog-orders')
      setOrders(await res.json())
    } catch { toast({ title: 'Failed to fetch orders', variant: 'destructive' }) }
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2"><BookOpen className="w-6 h-6 text-emerald-600" /> Medicine Catalog</h2>
          <p className="text-slate-500 text-sm">Browse available medicines for home delivery</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { fetchOrders(); setShowOrders(true) }}><Truck className="w-4 h-4 mr-1" /> View Orders</Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setShowOrderForm(true)} disabled={orderItems.length === 0}>
            <ShoppingCart className="w-4 h-4 mr-1" /> Cart ({orderItems.length}) {orderItems.length > 0 && `- ₹${orderTotal}`}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><Input placeholder="Search medicines by name..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" /></div>
        <Select value={selectedCat} onValueChange={setSelectedCat}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="All Categories" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Categories</SelectItem>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {/* Medicine Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map(med => {
            const totalStock = med.batches.reduce((s, b) => s + b.quantity, 0)
            const prices = med.batches.filter(b => b.quantity > 0).map(b => b.sellingPrice)
            const sellPrice = prices.length ? Math.min(...prices) : 0
            return (
              <Card key={med.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{med.name}</p>
                      <p className="text-xs text-slate-500">{med.genericName || ''} {med.strength ? `| ${med.strength}` : ''}</p>
                      {med.dosageForm && <Badge variant="outline" className="mt-1 text-xs">{med.dosageForm}</Badge>}
                    </div>
                    <span className="text-lg font-bold text-emerald-600 ml-2">₹{sellPrice}</span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-slate-400">Stock: {totalStock} {med.unit}</span>
                    <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => addToOrder(med)}><Plus className="w-3 h-3 mr-1" /> Add</Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
          {filtered.length === 0 && <div className="col-span-full text-center py-12 text-slate-400">No medicines found in catalog</div>}
        </div>
      )}

      {/* Cart / Order Dialog */}
      <Dialog open={showOrderForm} onOpenChange={setShowOrderForm}>
        <DialogContent className="max-w-lg w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Truck className="w-5 h-5 text-emerald-600" /> Home Delivery Order</DialogTitle><DialogDescription>Review your order and fill delivery details</DialogDescription></DialogHeader>
          {orderItems.length > 0 ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Order Items</h4>
                {orderItems.map(item => (
                  <div key={item.medicineId} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{item.medicineName}</p><p className="text-xs text-slate-500">₹{item.unitPrice} each</p></div>
                    <div className="flex items-center gap-2 ml-2">
                      <Button size="icon" variant="outline" className="w-7 h-7" onClick={() => updateOrderQty(item.medicineId, item.quantity - 1)}>-</Button>
                      <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                      <Button size="icon" variant="outline" className="w-7 h-7" onClick={() => updateOrderQty(item.medicineId, item.quantity + 1)}>+</Button>
                      <span className="ml-2 text-sm font-semibold w-16 text-right">₹{item.quantity * item.unitPrice}</span>
                    </div>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between text-sm"><span>Subtotal</span><span>₹{orderTotal.toFixed(2)}</span></div>
                <div className="flex justify-between text-sm"><span>Delivery Charge</span><span>₹{deliveryCharge}</span></div>
                <div className="flex justify-between font-bold"><span>Total</span><span className="text-emerald-600">₹{(orderTotal + deliveryCharge).toFixed(2)}</span></div>
              </div>
              <Separator />
              <div className="space-y-3">
                <h4 className="font-semibold text-sm flex items-center gap-1"><MapPin className="w-4 h-4" /> Delivery Details</h4>
                <div><Label>Customer Name *</Label><Input placeholder="Full name" value={orderName} onChange={e => setOrderName(e.target.value)} /></div>
                <div><Label>Phone *</Label><Input placeholder="Phone number" value={orderPhone} onChange={e => setOrderPhone(e.target.value)} /></div>
                <div><Label>Delivery Address</Label><Input placeholder="Full address" value={orderAddress} onChange={e => setOrderAddress(e.target.value)} /></div>
                <div><Label>Payment Method</Label><Select value={orderPayment} onValueChange={setOrderPayment}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Cash on Delivery">Cash on Delivery</SelectItem><SelectItem value="UPI">UPI</SelectItem><SelectItem value="Card">Card</SelectItem><SelectItem value="Phone Pay">Phone Pay</SelectItem></SelectContent></Select></div>
                <div><Label>Notes</Label><Input placeholder="Any special instructions" value={orderNotes} onChange={e => setOrderNotes(e.target.value)} /></div>
              </div>
              <DialogFooter><Button className="bg-emerald-600 hover:bg-emerald-700" onClick={submitOrder} disabled={orderLoading}>{orderLoading ? 'Placing Order...' : <><Send className="w-4 h-4 mr-1" /> Place Order</>}</Button></DialogFooter>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">Your cart is empty. Add medicines from the catalog.</div>
          )}
        </DialogContent>
      </Dialog>

      {/* Orders Dialog */}
      <Dialog open={showOrders} onOpenChange={setShowOrders}>
        <DialogContent className="max-w-2xl w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Truck className="w-5 h-5 text-emerald-600" /> Home Delivery Orders</DialogTitle></DialogHeader>
          {orders.length > 0 ? (
            <div className="space-y-3">
              {orders.map((order: any) => (
                <Card key={order.id}>
                  <CardContent className="p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-sm">{order.invoiceNo}</p>
                        <p className="text-sm text-slate-600">{order.customerName} - <Phone className="w-3 h-3 inline" /> {order.customerPhone}</p>
                        {order.prescription && (() => { try { const info = JSON.parse(order.prescription); return <p className="text-xs text-slate-500 mt-1"><MapPin className="w-3 h-3 inline" /> {info.address || 'No address'}</p> } catch { return null } })()}
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-emerald-600">₹{order.total}</p>
                        <Badge variant={order.status === 'Completed' ? 'secondary' : order.status === 'Pending' ? 'outline' : 'destructive'} className="text-xs">{order.status}</Badge>
                        <p className="text-xs text-slate-400 mt-1">{new Date(order.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      {order.items.map((item: any, i: number) => <span key={i}>{item.medicineName} x{item.quantity} {i < order.items.length - 1 ? ', ' : ''}</span>)}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">No delivery orders yet</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
