export declare class CustomerDto {
    fullName: string;
    docType: string;
    docNumber: string;
    monthlyIncome: number;
}
export declare class CreateRequestDto {
    country: string;
    customer: CustomerDto;
    amount: number;
    currency: string;
}
