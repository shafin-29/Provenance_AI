import os
from prisma import Prisma

prisma = Prisma(datasource={"url": os.getenv("DATABASE_URL")})
