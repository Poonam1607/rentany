import { Calendar, Clock, MapPin, User, MessageSquare } from 'lucide-react';
import { Booking } from '../types';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { toast } from 'sonner';

interface MyBookingsViewProps {
  bookings: Booking[];
  userId: string;
}

export function MyBookingsView({ bookings, userId }: MyBookingsViewProps) {
  const myRentals = bookings.filter((booking) => booking.renterId === userId);
  const myRentOuts = bookings.filter((booking) => booking.ownerId === userId);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'default';
      case 'active':
        return 'default';
      case 'completed':
        return 'secondary';
      case 'cancelled':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleContact = (name: string) => {
    toast.info(`Contact ${name} feature coming soon`);
  };

  const handleCancel = (bookingId: string) => {
    toast.success('Booking cancelled');
  };

  const renderBookingCard = (booking: Booking, isRental: boolean) => (
    <Card key={booking.id} className="overflow-hidden">
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Image */}
          <div className="w-full md:w-40 h-40 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
            <ImageWithFallback
              src={booking.itemImage}
              alt={booking.itemTitle}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Details */}
          <div className="flex-1 space-y-4">
            <div>
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-xl font-semibold">{booking.itemTitle}</h3>
                <Badge variant={getStatusColor(booking.status)}>
                  {booking.status}
                </Badge>
              </div>

              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  <span>
                    {isRental ? 'Owner' : 'Renter'}: {isRental ? booking.ownerName : booking.renterName}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>Start: {formatDate(booking.startTime)}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>End: {formatDate(booking.endTime)}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>{booking.totalHours} hours total</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <div>
                <span className="text-sm text-gray-500">Total Cost</span>
                <p className="text-2xl font-bold text-blue-600">${booking.totalCost}</p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleContact(isRental ? booking.ownerName : booking.renterName)}
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Contact
                </Button>
                {booking.status === 'confirmed' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCancel(booking.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">My Bookings</h1>
        <p className="text-gray-600">Manage your rentals and reservations</p>
      </div>

      <Tabs defaultValue="rentals" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="rentals">
            My Rentals ({myRentals.length})
          </TabsTrigger>
          <TabsTrigger value="rentouts">
            Rented Out ({myRentOuts.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rentals" className="mt-6">
          {myRentals.length === 0 ? (
            <div className="text-center py-16">
              <h3 className="text-xl font-semibold mb-2">No Rentals Yet</h3>
              <p className="text-gray-600 mb-6">
                Start browsing items available near you
              </p>
              <Button>Discover Items</Button>
            </div>
          ) : (
            <div className="space-y-6">
              {myRentals.map((booking) => renderBookingCard(booking, true))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="rentouts" className="mt-6">
          {myRentOuts.length === 0 ? (
            <div className="text-center py-16">
              <h3 className="text-xl font-semibold mb-2">No Bookings Yet</h3>
              <p className="text-gray-600">
                Your listed items haven't been booked yet
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {myRentOuts.map((booking) => renderBookingCard(booking, false))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
