import { SidebarProvider } from "../../context/SidebarContext";
import { Sidebar } from "../../components/Sidebar";
import { MainContent } from "../../components/MainContent";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="flex h-full overflow-hidden">
        <Sidebar />
        <MainContent>
          {children}
        </MainContent>
      </div>
    </SidebarProvider>
  );
}
