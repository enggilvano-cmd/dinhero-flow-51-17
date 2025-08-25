import { Home, CreditCard, ArrowLeftRight, BarChart3, Settings, Tag, Users, LogOut, User, Receipt } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";

interface LayoutProps {
  children: React.ReactNode;
  currentPage: string;
  onPageChange: (page: string) => void;
}

const getMenuItems = (isAdmin: boolean) => [
  { id: "dashboard", label: "Painel", icon: Home },
  { id: "accounts", label: "Contas", icon: CreditCard },
  { id: "credit-bills", label: "Faturas Cartão", icon: Receipt },
  { id: "transactions", label: "Transações", icon: ArrowLeftRight },
  { id: "categories", label: "Categorias", icon: Tag },
  { id: "analytics", label: "Análises", icon: BarChart3 },
];

function AppSidebar({ currentPage, onPageChange }: { currentPage: string; onPageChange: (page: string) => void }) {
  const { profile, isAdmin, signOut } = useAuth();
  const { state: sidebarState, setOpenMobile, toggleSidebar } = useSidebar();
  const isMobile = useIsMobile();
  const isCollapsed = sidebarState === "collapsed";
  const menuItems = getMenuItems(isAdmin());

  const handlePageChange = (page: string) => {
    onPageChange(page);
    // Auto-close sidebar after selecting menu item on mobile only
    if (isMobile) {
      setOpenMobile(false);
    }
    // On desktop, keep sidebar expanded after menu selection
  };

  return (
    <Sidebar 
      className={cn(
        "transition-all duration-300 ease-out z-50",
        isMobile 
          ? "fixed inset-y-0 left-0 w-80 lg:relative lg:w-64" 
          : isCollapsed 
            ? "w-16" 
            : "w-64"
      )}
      collapsible={isMobile ? "offcanvas" : "icon"}
      variant={isMobile ? "floating" : "sidebar"}
    >
      <SidebarContent 
        className={cn(
          "backdrop-blur-xl border-r shadow-lg h-full bg-sidebar border-sidebar-border"
        )}
      >
        {/* Header - Responsive design */}
        <div className={cn(
          "border-b border-border/30 flex items-center justify-between",
          isMobile 
            ? "px-4 py-4" 
            : isCollapsed 
              ? "px-3 py-6 flex-col gap-4" 
              : "px-4 py-6"
        )}>
          {!isCollapsed || isMobile ? (
            <div className={cn(
              "flex items-center justify-between w-full",
              isMobile && "flex-row"
            )}>
              <div className="flex items-center gap-3">
                <div className={cn(
                  "rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 flex items-center justify-center shadow-lg",
                  isMobile ? "h-8 w-8" : "h-10 w-10"
                )}>
                  <BarChart3 className={cn(
                    "text-yellow-400",
                    isMobile ? "h-5 w-5" : "h-6 w-6"
                  )} />
                </div>
                <div>
                  <h1 className={cn(
                    "font-bold tracking-tight text-foreground",
                    isMobile ? "text-lg" : "text-xl"
                  )}>
                    PlaniFlow
                  </h1>
                  <p className={cn(
                    "text-muted-foreground mt-1 font-medium",
                    isMobile ? "text-xs" : "text-sm"
                  )}>
                    Gestão Financeira
                  </p>
                </div>
              </div>
              <SidebarTrigger className={cn(
                "hover:bg-muted/50 rounded-xl transition-all duration-200 hover:scale-105",
                isMobile ? "h-8 w-8" : "h-9 w-9"
              )} />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 flex items-center justify-center shadow-lg">
                <BarChart3 className="h-6 w-6 text-yellow-400" />
              </div>
              <SidebarTrigger className="h-8 w-8 hover:bg-muted/50 rounded-xl transition-all duration-200 hover:scale-105" />
            </div>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className={cn(
            "text-xs font-semibold text-muted-foreground uppercase tracking-wider",
            isMobile 
              ? "px-4 py-3" 
              : isCollapsed 
                ? "px-0 py-2 text-center" 
                : "px-4 py-3"
          )}>
            {!isCollapsed || isMobile ? "Menu Principal" : (
              <div className="w-full flex justify-center">
                <div className="w-8 h-px bg-border rounded-full"></div>
              </div>
            )}
          </SidebarGroupLabel>
          
          <SidebarGroupContent className={cn(
            isMobile 
              ? "px-4" 
              : isCollapsed 
                ? "px-0" 
                : "px-4"
          )}>
            <SidebarMenu className={cn(
              "space-y-2", 
              isCollapsed && !isMobile && "space-y-3 items-center"
            )}>
              {menuItems.map((item, index) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      onClick={() => handlePageChange(item.id)}
                      isActive={isActive}
                      className={cn(
                        "w-full transition-all duration-300 group relative overflow-hidden",
                        isMobile
                          ? "h-12 rounded-2xl"
                          : isCollapsed 
                            ? "h-14 w-14 rounded-2xl justify-center items-center p-0 mx-auto flex shrink-0" 
                            : "h-12 rounded-2xl",
                        isActive
                          ? isMobile
                            ? "bg-gradient-to-r from-primary to-primary-glow text-primary-foreground shadow-lg scale-[1.01]"
                            : isCollapsed
                              ? "bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-xl scale-105 ring-2 ring-primary/20"
                              : "bg-gradient-to-r from-primary to-primary-glow text-primary-foreground shadow-lg scale-[1.02]"
                          : isMobile
                            ? "text-muted-foreground hover:bg-muted/50 hover:text-foreground hover:scale-[1.01]"
                            : isCollapsed
                              ? "text-muted-foreground hover:bg-muted hover:text-foreground hover:scale-110 hover:shadow-md"
                              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground hover:scale-[1.01]"
                      )}
                      tooltip={isCollapsed && !isMobile ? item.label : undefined}
                    >
                      {isCollapsed && !isMobile ? (
                        <div className="flex w-full items-center justify-center">
                          <Icon
                            className={cn(
                              "h-6 w-6 flex-shrink-0 transition-all duration-300",
                              isActive
                                ? "text-primary-foreground"
                                : "text-muted-foreground group-hover:text-foreground"
                            )}
                          />
                        </div>
                      ) : (
                        <Icon
                          className={cn(
                            "transition-all duration-300",
                            isMobile ? "h-5 w-5 mr-3" : "h-5 w-5 mr-3",
                            isActive
                              ? "text-primary-foreground"
                              : "text-muted-foreground group-hover:text-foreground"
                          )}
                        />
                      )}
                      
                      {(!isCollapsed || isMobile) && (
                        <>
                          <span className={cn(
                            "font-medium transition-all duration-300",
                            isMobile ? "text-sm" : "text-sm"
                          )}>
                            {item.label}
                          </span>
                          {/* Active indicator for expanded state */}
                          {isActive && (
                            <div className="absolute right-3 w-2 h-2 rounded-full bg-primary-foreground/80" />
                          )}
                        </>
                      )}
                      
                      {/* Active indicator for collapsed state */}
                      {isActive && isCollapsed && !isMobile && (
                        <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary-foreground rounded-l-full" />
                      )}
                    </SidebarMenuButton>
                    
                    {/* Separator between items when collapsed */}
                    {isCollapsed && !isMobile && index < menuItems.length - 1 && (
                      <div className="flex justify-center py-1">
                        <div className="w-6 h-px bg-border/50"></div>
                      </div>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* User Profile Section */}
        <div className={cn(
          "mt-auto border-t border-border/30",
           isMobile 
             ? "px-4 py-4" 
             : isCollapsed 
               ? "px-0 py-4 flex justify-center" 
               : "px-4 py-4"
        )}>
          {profile && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className={cn(
                    "transition-all duration-200 hover:bg-muted/50",
                    isMobile
                      ? "w-full h-12 rounded-2xl justify-start gap-3"
                      : isCollapsed 
                        ? "h-14 w-14 rounded-2xl p-0 flex items-center justify-center"
                        : "w-full h-12 rounded-2xl justify-start gap-3"
                  )}
                >
                  <Avatar className={cn(
                    isMobile ? "h-8 w-8" : isCollapsed ? "h-10 w-10" : "h-8 w-8"
                  )}>
                    <AvatarImage src={profile.avatar_url} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {profile.full_name?.charAt(0) || profile.email.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  {(!isCollapsed || isMobile) && (
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium truncate">
                        {profile.full_name || 'Usuário'}
                      </p>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={profile.role === 'admin' ? 'destructive' : 'secondary'}
                          className="text-xs"
                        >
                          {profile.role === 'admin' ? 'Admin' : profile.role === 'user' ? 'Usuário' : 'Limitado'}
                        </Badge>
                      </div>
                    </div>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onPageChange('profile')}>
                  <User className="mr-2 h-4 w-4" />
                  Perfil
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onPageChange('settings')}>
                  <Settings className="mr-2 h-4 w-4" />
                  Configurações
                </DropdownMenuItem>
                {isAdmin() && (
                  <>
                    <DropdownMenuItem onClick={() => onPageChange('users')}>
                      <Users className="mr-2 h-4 w-4" />
                      Gerenciar Usuários
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onPageChange('system-settings')}>
                      <Settings className="mr-2 h-4 w-4" />
                      Config. Sistema
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </SidebarContent>
    </Sidebar>
  );
}

export function Layout({ children, currentPage, onPageChange }: LayoutProps) {
  const isMobile = useIsMobile();
  const { profile } = useAuth();
  
  return (
    <SidebarProvider defaultOpen={!isMobile}>
      <div className={cn(
        "min-h-screen flex flex-col w-full relative bg-background",
        isMobile && "overflow-hidden"
      )}>
        
        {/* Mobile Header */}
        {isMobile && (
          <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-background/95 backdrop-blur-xl border-b border-border/50 shadow-sm">
            <div className="flex items-center justify-between h-full px-4">
              <div className="flex items-center gap-3">
                <SidebarTrigger className="h-10 w-10 hover:bg-muted/50 rounded-xl transition-all duration-200 hover:scale-105 flex items-center justify-center">
                  <div className="w-5 h-5 flex flex-col justify-center gap-1">
                    <div className="w-full h-0.5 bg-foreground rounded-full"></div>
                    <div className="w-full h-0.5 bg-foreground rounded-full"></div>
                    <div className="w-full h-0.5 bg-foreground rounded-full"></div>
                  </div>
                </SidebarTrigger>
                <div className="h-8 w-8 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 flex items-center justify-center shadow-lg">
                  <BarChart3 className="h-5 w-5 text-yellow-400" />
                </div>
                <div>
                  <h1 className="text-lg font-bold tracking-tight text-foreground">
                    PlaniFlow
                  </h1>
                </div>
              </div>
              {profile && (
                <Avatar className="h-8 w-8">
                  <AvatarImage src={profile.avatar_url} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                    {profile.full_name?.charAt(0) || profile.email.charAt(0)}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          </header>
        )}

        <div className={cn(
          "flex flex-1 w-full",
          isMobile && "pt-16"
        )}>
          <AppSidebar currentPage={currentPage} onPageChange={onPageChange} />
          
          {/* Main content with responsive design */}
          <main className={cn(
            "flex-1 overflow-auto",
            isMobile && "w-full min-h-0"
          )}>
            <div className={cn(
              isMobile 
                ? "p-2 sm:p-3" 
                : "p-4 lg:p-6 xl:p-8"
            )}>
              <div className={cn(
                "mx-auto w-full",
                isMobile 
                  ? "max-w-full" 
                  : "max-w-7xl"
              )}>
                {children}
              </div>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}