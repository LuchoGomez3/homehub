import { Prisma, PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create demo family
  const passwordHash = await bcrypt.hash('demo1234', 12);

  const family = await prisma.family.upsert({
    where: { id: 'demo-family' },
    update: {},
    create: {
      id: 'demo-family',
      name: 'Familia Demo',
      members: {
        create: [
          {
            id: 'user-admin',
            email: 'admin@demo.com',
            passwordHash,
            name: 'Admin User',
            role: 'ADMIN',
            language: 'es',
            theme: 'system',
          },
          {
            id: 'user-member',
            email: 'member@demo.com',
            passwordHash,
            name: 'Member User',
            role: 'MEMBER',
            language: 'es',
            theme: 'system',
          },
        ],
      },
    },
    include: { members: true },
  });

  console.log('✅ Family created:', family.name);

  const admin = family.members.find((m) => m.role === 'ADMIN')!;
  const member = family.members.find((m) => m.role === 'MEMBER')!;

  // Create sample expenses
  const expenseCategories = ['FOOD', 'TRANSPORT', 'HOUSING', 'UTILITIES', 'HEALTH', 'EDUCATION', 'ENTERTAINMENT', 'CLOTHING', 'OTHER'];
  const expenses = [
    { amount: 150.00, category: 'FOOD', description: 'Supermercado semanal', date: new Date('2024-01-15'), userId: admin.id },
    { amount: 45.50, category: 'TRANSPORT', description: 'Gasolina', date: new Date('2024-01-14'), userId: admin.id },
    { amount: 80.00, category: 'UTILITIES', description: 'Factura electricidad', date: new Date('2024-01-10'), userId: admin.id },
    { amount: 25.00, category: 'ENTERTAINMENT', description: 'Cine familiar', date: new Date('2024-01-12'), userId: member.id },
    { amount: 200.00, category: 'HOUSING', description: 'Alquiler', date: new Date('2024-01-01'), isRecurring: true, recurrence: 'MONTHLY', userId: admin.id },
  ] satisfies Omit<Prisma.ExpenseUncheckedCreateInput, 'familyId'>[];

  for (const exp of expenses) {
    await prisma.expense.create({
      data: { ...exp, familyId: family.id },
    });
  }
  console.log('✅ Sample expenses created');

  // Create sample bills
  const bills = [
    { name: 'Electricidad', amount: 85.30, dueDate: new Date('2024-02-15'), category: 'SERVICES', status: 'PENDING', recurrence: 'MONTHLY', familyId: family.id },
    { name: 'Internet', amount: 45.00, dueDate: new Date('2024-02-20'), category: 'SERVICES', status: 'PENDING', recurrence: 'MONTHLY', familyId: family.id },
    { name: 'IBI', amount: 320.00, dueDate: new Date('2024-03-31'), category: 'TAXES', status: 'PENDING', recurrence: 'YEARLY', familyId: family.id },
    { name: 'Seguro hogar', amount: 180.00, dueDate: new Date('2024-01-30'), category: 'INSURANCE', status: 'OVERDUE', recurrence: 'YEARLY', familyId: family.id },
  ] satisfies Prisma.BillUncheckedCreateInput[];

  for (const bill of bills) {
    await prisma.bill.create({ data: bill });
  }
  console.log('✅ Sample bills created');

  // Create sample todos
  const todos = [
    { title: 'Comprar regalo cumpleaños abuela', description: 'Le gusta la jardinería', status: 'PENDING', priority: 'HIGH', dueDate: new Date('2024-02-10'), familyId: family.id, assigneeId: admin.id },
    { title: 'Llamar al fontanero', description: 'Goteo en baño principal', status: 'IN_PROGRESS', priority: 'URGENT', dueDate: new Date('2024-01-20'), familyId: family.id, assigneeId: member.id },
    { title: 'Renovar DNI', description: 'Caduca en marzo', status: 'PENDING', priority: 'MEDIUM', dueDate: new Date('2024-02-28'), familyId: family.id, assigneeId: admin.id },
    { title: 'Hacer la declaración de la renta', status: 'PENDING', priority: 'HIGH', dueDate: new Date('2024-06-30'), familyId: family.id },
    { title: 'Comprar pilas para el mando', status: 'DONE', priority: 'LOW', familyId: family.id, assigneeId: member.id },
  ] satisfies Prisma.TodoUncheckedCreateInput[];

  for (const todo of todos) {
    await prisma.todo.create({ data: todo });
  }
  console.log('✅ Sample todos created');

  // Create sample shopping items
  const shoppingItems = [
    { name: 'Leche', quantity: 2, unit: 'litros', category: 'FRESH', familyId: family.id, addedById: admin.id },
    { name: 'Pan', quantity: 1, unit: 'barra', category: 'FRESH', familyId: family.id, addedById: member.id },
    { name: 'Detergente', quantity: 1, unit: 'botella', category: 'CLEANING', familyId: family.id, addedById: admin.id },
    { name: 'Manzanas', quantity: 2, unit: 'kg', category: 'FRESH', isDone: true, familyId: family.id, addedById: member.id },
    { name: 'Papel higiénico', quantity: 1, unit: 'pack 12', category: 'PANTRY', familyId: family.id, addedById: admin.id },
    { name: 'Yogures', quantity: 8, unit: 'unidades', category: 'FRESH', familyId: family.id, addedById: member.id },
  ] satisfies Prisma.ShoppingItemUncheckedCreateInput[];

  for (const item of shoppingItems) {
    await prisma.shoppingItem.create({ data: item });
  }
  console.log('✅ Sample shopping items created');

  // Create sample events
  const events = [
    { title: 'Cumpleaños abuela', description: 'Celebración familiar', startDate: new Date('2024-02-10T14:00:00'), endDate: new Date('2024-02-10T18:00:00'), allDay: false, color: '#EF4444', familyId: family.id, attendees: { connect: [{ id: admin.id }, { id: member.id }] } },
    { title: 'Reunión comunidad', startDate: new Date('2024-01-25T19:00:00'), endDate: new Date('2024-01-25T20:30:00'), allDay: false, color: '#3B82F6', familyId: family.id, attendees: { connect: [{ id: admin.id }] } },
    { title: 'Cita dentista', description: 'Revisión anual', startDate: new Date('2024-02-05T10:00:00'), endDate: new Date('2024-02-05T10:30:00'), allDay: false, color: '#10B981', familyId: family.id, attendees: { connect: [{ id: member.id }] } },
    { title: 'Fin de semana en la playa', startDate: new Date('2024-03-15'), endDate: new Date('2024-03-17'), allDay: true, color: '#F59E0B', familyId: family.id, attendees: { connect: [{ id: admin.id }, { id: member.id }] } },
  ] satisfies Prisma.EventUncheckedCreateInput[];

  for (const event of events) {
    await prisma.event.create({ data: event });
  }
  console.log('✅ Sample events created');

  console.log('🎉 Seeding completed!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });