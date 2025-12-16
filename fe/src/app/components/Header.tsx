import { Menu, Package, User, Calendar, Plus } from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface HeaderProps {
  currentView: string;
  onViewChange: (view: string) => void;
  userName: string;
  userRating: number;
}

export function Header({ currentView, onViewChange, userName, userRating }: HeaderProps) {
  return (
    <header className="border-b bg-white sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <button
            onClick={() => onViewChange('discover')}
            className="flex items-center gap-2 hover:opacity-70 transition-opacity"
          >
            <Package className="w-8 h-8 text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">RentAny</span>
          </button>

          <nav className="hidden md:flex items-center gap-1">
            <Button
              variant={currentView === 'discover' ? 'default' : 'ghost'}
              onClick={() => onViewChange('discover')}
            >
              Discover
            </Button>
            <Button
              variant={currentView === 'my-listings' ? 'default' : 'ghost'}
              onClick={() => onViewChange('my-listings')}
            >
              My Listings
            </Button>
            <Button
              variant={currentView === 'my-bookings' ? 'default' : 'ghost'}
              onClick={() => onViewChange('my-bookings')}
            >
              My Bookings
            </Button>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={() => onViewChange('add-item')} className="hidden sm:flex">
            <Plus className="w-4 h-4 mr-2" />
            List Item
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <User className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-2">
                <p className="font-medium">{userName}</p>
                <p className="text-sm text-gray-500">Rating: ⭐ {userRating.toFixed(1)}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onViewChange('my-listings')}>
                <Package className="w-4 h-4 mr-2" />
                My Listings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onViewChange('my-bookings')}>
                <Calendar className="w-4 h-4 mr-2" />
                My Bookings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onViewChange('add-item')}>
                <Plus className="w-4 h-4 mr-2" />
                List New Item
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => onViewChange('discover')}>
                Discover
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onViewChange('my-listings')}>
                My Listings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onViewChange('my-bookings')}>
                My Bookings
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
