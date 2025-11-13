// Navigation component with role-based menu
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/auth/AuthProvider';
import { hasPermission } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  ClipboardList,
  FileText,
  Users,
  Activity,
  Settings,
  LogOut,
  Bell,
  Menu,
  X,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useQuery } from '@tanstack/react-query';
import { fetchAlerts } from '@/services/alerts';

interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
  module?: string;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Inventory', path: '/inventory', icon: Package, permission: 'products.view' },
  { label: 'Sales', path: '/sales', icon: ShoppingCart, permission: 'sales.view' },
  { label: 'Stocktake', path: '/stocktake', icon: ClipboardList, permission: 'stocktake.create' },
  { label: 'Reports', path: '/reports', icon: FileText, permission: 'reports.view' },
  { label: 'Users', path: '/users', icon: Users, permission: 'users.view' },
  { label: 'Audit Log', path: '/audit', icon: Activity, permission: 'audit.view' },
  { label: 'Settings', path: '/settings', icon: Settings, permission: 'settings.view' },
];

export const Navigation: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const unreadAlertsQuery = useQuery({
    queryKey: ['alerts', 'unread'],
    queryFn: () => fetchAlerts('unread'),
  });

  const unreadAlerts = unreadAlertsQuery.data?.length ?? 0;

  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const filteredNavItems = navItems.filter(item => {
    if (item.permission) {
      return hasPermission(user.role, item.permission as any);
    }
    return true;
  });

  return (
    <nav className="border-b bg-background sticky top-0 z-50">
      <div className="container mx-auto px-2 sm:px-4">
        <div className="flex h-14 sm:h-16 items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-4 lg:space-x-8">
            <Link to="/dashboard" className="flex items-center">
              <img
                src="/Sahablogo.jpg"
                alt="Sahab Pharmacy logo"
                className="h-9 w-auto sm:h-10 mr-2 rounded-md border border-border bg-white object-contain p-1 shadow-sm"
              />
              <span className="font-bold text-lg sm:text-xl text-primary">Sahab Pharmacy</span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center space-x-1">
              {filteredNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link key={item.path} to={item.path}>
                    <Button
                      variant={isActive ? 'secondary' : 'ghost'}
                      className="flex items-center space-x-2"
                      size="sm"
                    >
                      <Icon className="h-4 w-4" />
                      <span className="hidden xl:inline">{item.label}</span>
                      {item.label === 'Dashboard' && unreadAlerts > 0 && (
                        <Badge variant="destructive" className="ml-1">
                          {unreadAlerts}
                        </Badge>
                      )}
                    </Button>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4">
            <Link to="/alerts">
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
                {unreadAlerts > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -right-1 h-4 w-4 sm:h-5 sm:w-5 flex items-center justify-center p-0 text-xs"
                  >
                    {unreadAlerts}
                  </Badge>
                )}
              </Button>
            </Link>

            {/* Mobile Menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64">
                <div className="flex flex-col space-y-4 mt-8">
                  {filteredNavItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <Button
                          variant={isActive ? 'secondary' : 'ghost'}
                          className="w-full justify-start"
                        >
                          <Icon className="h-4 w-4 mr-2" />
                          {item.label}
                          {item.label === 'Dashboard' && unreadAlerts > 0 && (
                            <Badge variant="destructive" className="ml-auto">
                              {unreadAlerts}
                            </Badge>
                          )}
                        </Button>
                      </Link>
                    );
                  })}
                </div>
              </SheetContent>
            </Sheet>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center space-x-2">
                  <Avatar className="h-7 w-7 sm:h-8 sm:w-8">
                    <AvatarFallback className="text-xs sm:text-sm">{getInitials(user.fullName)}</AvatarFallback>
                  </Avatar>
                  <div className="text-left hidden sm:block">
                    <div className="text-xs sm:text-sm font-medium">{user.fullName}</div>
                    <div className="text-xs text-muted-foreground">
                      {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </div>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="end" 
                className="w-56 max-h-[calc(100vh-4rem)] overflow-y-auto"
                sideOffset={5}
                alignOffset={-10}
              >
                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                  {user.email || user.username}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>
  );
};


