<?php

namespace App\Service\Ocr;

use Symfony\Component\HttpFoundation\File\UploadedFile;

class MockOcrService implements OcrServiceInterface
{
    public function extractTotal(UploadedFile $file): ?string
    {
        $filename = $file->getClientOriginalName();

        // Mock implementation for provided test cases
        return match ($filename) {
            'test.jpg'                => '1.71',
            'ticket.jpg'               => '7.72',
            'ticket de caisse.jpg',
            'ticket-de-caisse.jpg'    => '4.00',
            default                   => null,
        };
    }
}
