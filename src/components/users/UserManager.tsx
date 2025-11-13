// User Manager component
import React, { useEffect, useState } from 'react';
import { User, UserRole } from '@/lib/types';
import { useAuth } from '@/components/auth/AuthProvider';
import { hasPermission } from '@/lib/permissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Plus, Edit, Trash2, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createUser,
  deactivateUser,
  fetchUsers,
  updateUser,
  UpdateUserInput,
  CreateUserInput,
} from '@/services/users';
import { recordAuditLog } from '@/services/audit';

export const UserManager: React.FC = () => {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [users, setUsers] = useState<User[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<Partial<User>>({
    username: '',
    password: '',
    role: 'cashier',
    fullName: '',
    email: '',
    active: true,
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
  });

  useEffect(() => {
    if (usersQuery.data) {
      setUsers(usersQuery.data);
    }
  }, [usersQuery.data]);

  const handleOpenDialog = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        username: user.username,
        password: '', // Don't pre-fill password
        role: user.role,
        fullName: user.fullName,
        email: user.email,
        active: user.active,
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: '',
        password: '',
        role: 'cashier',
        fullName: '',
        email: '',
        active: true,
      });
    }
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!currentUser) return;

    if (!formData.username || !formData.fullName || !formData.role) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    if (!editingUser && !formData.password) {
      toast({
        title: 'Validation Error',
        description: 'Password is required for new users',
        variant: 'destructive',
      });
      return;
    }

    const getInputPayload = (): CreateUserInput | UpdateUserInput => ({
      username: formData.username!,
      password: formData.password || undefined,
      role: formData.role as UserRole,
      fullName: formData.fullName!,
      email: formData.email || undefined,
      active: formData.active ?? true,
    });

    const performSave = async () => {
      if (!currentUser) return;

      try {
        setSaving(true);
        if (editingUser) {
          const updatePayload: UpdateUserInput = {
            password: formData.password || undefined,
            role: formData.role as UserRole,
            fullName: formData.fullName,
            email: formData.email,
            active: formData.active,
          };

          await updateUser(editingUser.id, updatePayload);

          await recordAuditLog({
            userId: currentUser.id,
            userName: currentUser.fullName,
            module: 'users',
            action: 'update_user',
            details: `Updated user: ${formData.username}`,
            resourceId: editingUser.id,
            resourceType: 'user',
          });
          toast({
            title: 'User Updated',
            description: `User ${formData.username} has been updated`,
          });
        } else {
          const createPayload = getInputPayload() as CreateUserInput;
          await createUser(createPayload);

          await recordAuditLog({
            userId: currentUser.id,
            userName: currentUser.fullName,
            module: 'users',
            action: 'create_user',
            details: `Created user: ${formData.username}`,
            resourceType: 'user',
          });

          toast({
            title: 'User Created',
            description: `User ${formData.username} has been created`,
          });
        }

        await queryClient.invalidateQueries({ queryKey: ['users'] });
        setDialogOpen(false);
        setEditingUser(null);
        setFormData({
          username: '',
          password: '',
          role: 'cashier',
          fullName: '',
          email: '',
          active: true,
        });
      } catch (error) {
        console.error(error);
        toast({
          title: 'Error',
          description: (error as Error).message ?? 'Failed to save user',
          variant: 'destructive',
        });
      } finally {
        setSaving(false);
      }
    };

    void performSave();
  };

  const handleDelete = (userId: string) => {
    if (!currentUser) return;
    if (userId === currentUser.id) {
      toast({
        title: 'Cannot Delete',
        description: 'You cannot delete your own account',
        variant: 'destructive',
      });
      return;
    }

    const userToDelete = users.find((u) => u.id === userId);
    if (!userToDelete) {
      toast({
        title: 'User Not Found',
        description: 'Unable to locate the selected user',
        variant: 'destructive',
      });
      return;
    }

    if (!confirm(`Are you sure you want to deactivate user ${userToDelete.username}?`)) {
      return;
    }

    const performDelete = async () => {
      try {
        setDeleting(userId);
        await deactivateUser(userId);
        await recordAuditLog({
          userId: currentUser.id,
          userName: currentUser.fullName,
          module: 'users',
          action: 'delete_user',
          details: `Deactivated user: ${userToDelete.username}`,
          resourceId: userId,
          resourceType: 'user',
        });
        toast({
          title: 'User Deactivated',
          description: `User ${userToDelete.username} has been deactivated`,
        });
        await queryClient.invalidateQueries({ queryKey: ['users'] });
      } catch (error) {
        console.error(error);
        toast({
          title: 'Error',
          description: (error as Error).message ?? 'Failed to deactivate user',
          variant: 'destructive',
        });
      } finally {
        setDeleting(null);
      }
    };

    void performDelete();
  };

  if (!currentUser || !hasPermission(currentUser.role, 'users.view')) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">You don't have permission to access this module</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">User Management</h2>
          <p className="text-muted-foreground text-sm sm:text-base">Manage system users</p>
        </div>
        {hasPermission(currentUser.role, 'users.add') && (
          <Button onClick={() => handleOpenDialog()} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Users</CardTitle>
          <CardDescription>System users and their roles</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[100px]">Username</TableHead>
                  <TableHead className="min-w-[120px]">Full Name</TableHead>
                  <TableHead className="min-w-[150px]">Email</TableHead>
                  <TableHead className="min-w-[80px]">Role</TableHead>
                  <TableHead className="min-w-[80px]">Status</TableHead>
                  <TableHead className="min-w-[100px]">Created</TableHead>
                  <TableHead className="text-right min-w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      {usersQuery.isLoading ? 'Loading users...' : 'No users found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.username}</TableCell>
                      <TableCell>{user.fullName}</TableCell>
                      <TableCell>{user.email || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                          {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.active ? 'default' : 'destructive'}>
                          {user.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right space-x-2">
                        {hasPermission(currentUser.role, 'users.edit') && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenDialog(user)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {hasPermission(currentUser.role, 'users.delete') && user.id !== currentUser.id && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(user.id)}
                            disabled={deleting === user.id}
                          >
                            {deleting === user.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* User Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Edit User' : 'Add New User'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="username">Username *</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
                disabled={!!editingUser}
              />
            </div>

            <div>
              <Label htmlFor="password">Password {!editingUser && '*'}</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required={!editingUser}
                placeholder={editingUser ? 'Leave blank to keep current' : ''}
              />
            </div>

            <div>
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="role">Role *</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value as UserRole })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="cashier">Cashier</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="active"
                checked={formData.active ?? true}
                onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
              />
              <Label htmlFor="active">Active</Label>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingUser ? 'Update' : 'Create'} User
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};


