import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { NavLink } from '@/components/NavLink';
import {
  LayoutDashboard,
  Layers,
  DollarSign,
  ShoppingCart,
  ClipboardList,
  Shield,
  LogOut,
  Settings,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const navItems = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Collections', url: '/collections', icon: Layers },
  { title: 'Sales', url: '/sales', icon: ShoppingCart },
  { title: 'Finance', url: '/finance', icon: DollarSign },
  { title: 'Activity Log', url: '/activity', icon: ClipboardList },
];

interface AppSidebarProps {
  orgName?: string;
  orgLogo?: string | null;
}

export function AppSidebar({ orgName, orgLogo }: AppSidebarProps) {
  const { signOut, user } = useAuth();

  return (
    <Sidebar collapsible="icon">
      <div className="flex h-12 items-center gap-2 border-b border-sidebar-border px-3">
        {orgLogo ? (
          <img src={orgLogo} alt="" className="h-7 w-7 rounded object-cover" />
        ) : (
          <Shield className="h-6 w-6 text-primary shrink-0" />
        )}
        <span className="font-display text-sm font-semibold truncate group-data-[collapsible=icon]:hidden">
          {orgName || 'Card Collector Pro'}
        </span>
      </div>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/dashboard'}
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-primary font-medium"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="border-t border-sidebar-border p-3 group-data-[collapsible=icon]:px-2">
          <p className="text-xs text-muted-foreground truncate mb-2 group-data-[collapsible=icon]:hidden">
            {user?.email}
          </p>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className="group-data-[collapsible=icon]:hidden">Sign Out</span>
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
