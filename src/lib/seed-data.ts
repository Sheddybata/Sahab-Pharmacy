import { seedSupabaseDemoData } from '@/services/settings';
import { fetchUserByUsername } from '@/services/users';

/**
 * Legacy seed helper retained for backwards compatibility with the old store initialiser.
 * The actual seeding now delegates to Supabase-backed services and runs asynchronously.
 */
export const seedDemoData = (): void => {
  void (async () => {
    try {
      const adminUser = await fetchUserByUsername('admin');
      if (!adminUser) {
        console.warn('Admin user not found. Skipping Supabase demo seed.');
        return;
      }

      await seedSupabaseDemoData(adminUser.id, adminUser.fullName);
    } catch (error) {
      console.error('Failed to seed Supabase demo data:', error);
    }
  })();
};

