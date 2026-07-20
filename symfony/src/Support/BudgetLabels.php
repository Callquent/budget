<?php

namespace App\Support;

/**
 * Source unique des libellés utilisés par le module Budget
 * (contrôleur, formulaire, et exposés au frontend via l'API JSON)
 * pour éviter la duplication entre BudgetController, BudgetType
 * et les composants TSX BudgetMonthView / BudgetYearView.
 */
final class BudgetLabels
{
    public const MONTHS = [
        1  => 'Janvier',
        2  => 'Février',
        3  => 'Mars',
        4  => 'Avril',
        5  => 'Mai',
        6  => 'Juin',
        7  => 'Juillet',
        8  => 'Août',
        9  => 'Septembre',
        10 => 'Octobre',
        11 => 'Novembre',
        12 => 'Décembre',
    ];

    public const FREQUENCIES = [
        'monthly'    => 'mensuelle',
        'yearly'     => 'annuelle',
        'quarterly'  => 'trimestrielle',
        'occasional' => 'occasionnel',
    ];
}
