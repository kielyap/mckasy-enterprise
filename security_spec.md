# Security Specification for Mckasy Enterprise

## Data Invariants
1. Only authenticated users can access the system.
2. Invoices must have a valid customer ID.
3. Inventory deduction on invoices must be atomic (calculated by the app, but rules verify identity).
4. Users cannot modify financial outcomes (profit) without appropriate permissions (for now, any auth user is handled as admin/owner).

## The Dirty Dozen Payloads (Rejection Targets)
1. **Identity Spoofing**: Attempt to create a customer with an `ownerId` that isn't the current user (if I were using multi-tenancy, but for this app we'll assume any logged in user can access).
2. **Resource Poisoning**: Attempt to set a document ID to a 1MB string.
3. **State Shortcutting**: Attempt to update an invoice status from 'Paid' back to 'Unpaid'.
4. **Field Injection**: Attempt to add `isAdmin: true` to a user profile or ghost fields to a product.
5. **PII Leak**: Attempt to read all customer emails without being signed in.
6. **Negative Inventory**: Attempt to set `currentStock` to a negative number via update.
7. **Negative Price**: Attempt to set `sellingPrice` to -100.
8. **Invalid Relation**: Create an invoice for a customer that does not exist.
9. **Timestamp Spoof**: Client sending `createdAt` as a hardcoded date next year.
10. **ID Injection**: Using invalid characters in a document ID.
11. **Bulk Delete**: Attempting to delete the entire `products` collection.
12. **Recursive Cost Attack**: Listing thousands of invoices in a loop to drain wallet (rules must enforce query filters).

## Test Runner
I will verify these in `firestore.rules.test.ts`.
