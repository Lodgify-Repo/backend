import {Body,Controller,Get,Param,Patch,Post,Request,UseGuards,} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CreateBookingDto } from '../dto/create-booking.dto';
import { BookingsService } from '../services/bookings.service';

interface AuthenticatedRequest {
  user: { id: string };
}

@ApiTags('Bookings')
@ApiBearerAuth('access-token')
@Controller()
@UseGuards(JwtAuthGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post('properties/:propertyId/bookings')
  @ApiOperation({ summary: 'Create a booking for a property' })
  async createBooking(
    @Request() req: AuthenticatedRequest,
    @Param('propertyId') propertyId: string,
    @Body() dto: CreateBookingDto,
  ) {
    return this.bookingsService.createBooking(req.user.id, propertyId, dto);
  }

  @Get('bookings/me')
  @ApiOperation({ summary: 'List bookings made by the current user' })
  async getMyBookings(@Request() req: AuthenticatedRequest) {
    return this.bookingsService.getMyBookings(req.user.id);
  }

  @Get('bookings/:id')
  @ApiOperation({ summary: 'Get a booking by id (guest or property owner)' })
  async getBooking(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.bookingsService.getBooking(req.user.id, id);
  }

  @Patch('bookings/:id/cancel')
  @ApiOperation({ summary: 'Cancel a booking (guest or property owner)' })
  async cancelBooking(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.bookingsService.cancelBooking(req.user.id, id);
  }
}
