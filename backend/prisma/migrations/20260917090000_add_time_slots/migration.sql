-- AlterTable
ALTER TABLE "Mandi" ADD COLUMN     "slotCapacity" INTEGER NOT NULL DEFAULT 20;

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "timeSlot" TEXT;
