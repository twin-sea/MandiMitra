-- CreateTable
CREATE TABLE "BookingCrop" (
    "id" SERIAL NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "cropId" INTEGER NOT NULL,
    "quantityQuintal" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "BookingCrop_pkey" PRIMARY KEY ("id")
);

-- Move every real existing booking's single crop+quantity into the new
-- table before the old columns are dropped, so no real booking history is
-- lost - each existing Booking row becomes exactly one BookingCrop row.
INSERT INTO "BookingCrop" ("bookingId", "cropId", "quantityQuintal")
SELECT "id", "cropId", "quantityQuintal" FROM "Booking";

-- DropForeignKey
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_cropId_fkey";

-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "cropId",
                       DROP COLUMN "quantityQuintal";

-- AddForeignKey
ALTER TABLE "BookingCrop" ADD CONSTRAINT "BookingCrop_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingCrop" ADD CONSTRAINT "BookingCrop_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
